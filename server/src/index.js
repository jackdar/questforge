import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { createWorldState } from './world-state.js';
import { createCombat } from './combat.js';
import { createDatabasePool, connectWithRetry, runMigrations } from './database.js';
import { createAccountStore } from './account-store.js';
import { createCharacterStore } from './character-store.js';
import { createApi } from './api.js';
import { readSessionToken, isSameOriginRequest } from './session-cookie.js';
import { createChatRateLimiter } from './chat-rate-limit.js';
import { cleanChatMessage } from 'questforge-shared/chat-rules.js';

const PORT = Number(process.env.PORT ?? 3030);
const TICK_INTERVAL_MS = 50;
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));

// Players spawn at the origin facing +z, so the dummies stand in front of them.
const DUMMY_SPAWNS = [
  { x: -6, z: 10, rotation: Math.PI },
  { x: 0, z: 12, rotation: Math.PI },
  { x: 6, z: 10, rotation: Math.PI },
];

const world = createWorldState();
DUMMY_SPAWNS.forEach((spawn, index) => world.addDummy(`dummy-${index + 1}`, spawn));

const httpServer = createServer();

const socketServer = new WebSocketServer({ noServer: true });
const combat = createCombat(world, broadcast);
const accountsInWorld = new Set();
const chatRateLimiter = createChatRateLimiter();

// Only a logged-in account can open a game connection. The session cookie comes with the WebSocket handshake.
async function handleUpgrade(request, socket, head, { accountStore, characterStore }) {
  socket.on('error', (error) => console.warn(`A WebSocket handshake failed: ${error.message}`));

  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname !== '/ws') {
    rejectUpgrade(socket, 404, 'Not Found');
    return;
  }
  if (!isSameOriginRequest(request)) {
    rejectUpgrade(socket, 403, 'Forbidden');
    return;
  }

  let account;
  try {
    account = await accountStore.findAccountBySession(readSessionToken(request));
  } catch (error) {
    console.error(`Could not check the session of a WebSocket handshake: ${error.message}`);
    rejectUpgrade(socket, 500, 'Internal Server Error');
    return;
  }
  if (!account) {
    rejectUpgrade(socket, 401, 'Unauthorized');
    return;
  }

  socketServer.handleUpgrade(request, socket, head, (webSocket) =>
    handleConnection({ socket: webSocket, playerId: randomUUID(), account, characterStore }),
  );
}

function rejectUpgrade(socket, statusCode, statusText) {
  socket.end(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
}

function handleConnection(connection) {
  const { socket, playerId, account } = connection;

  socket.on('message', (data) => handleMessage(connection, data));
  socket.on('close', () => {
    if (world.removePlayer(playerId)) accountsInWorld.delete(account.id);
    combat.removeEntity(playerId);
    chatRateLimiter.forget(playerId);
  });
  socket.on('error', (error) => {
    console.error(`Socket error for player ${playerId}: ${error.message}`);
  });
}

function handleMessage(connection, data) {
  const { socket, playerId } = connection;
  let message;
  try {
    message = JSON.parse(data);
  } catch {
    console.warn(`Player ${playerId} sent a message that is not valid JSON. The server ignored it.`);
    return;
  }

  if (message?.type === 'join') handleJoin(connection, message.characterId);
  if (message?.type === 'move') handleMove(playerId, message);
  if (message?.type === 'stopAttack') combat.stopAutoAttack(playerId);
  if (message?.type === 'chat') handleChat(connection, message.text);
  if (message?.type === 'ping' && Number.isFinite(message.sentAt)) {
    socket.send(JSON.stringify({ type: 'pong', sentAt: message.sentAt }));
  }

  if (message?.type === 'cast') {
    const targetId = typeof message.targetId === 'string' ? message.targetId : null;
    const result = combat.startCast(playerId, message.spellId, targetId, Date.now());
    if (!result.ok) socket.send(JSON.stringify({ type: 'castFailed', message: result.message }));
  }
}

// An account can have only one character in the world at a time.
async function handleJoin({ socket, playerId, account, characterStore }, characterId) {
  if (world.getEntity(playerId)) return;
  if (accountsInWorld.has(account.id)) {
    sendJoinFailed(socket, 'A character from your account is already in the world. Leave the game there first.');
    return;
  }

  // Reserve the account before the database lookup, so that two join messages at the same time cannot both succeed.
  accountsInWorld.add(account.id);
  let character;
  try {
    character = await characterStore.findCharacterForAccount(characterId, account.id);
  } catch (error) {
    accountsInWorld.delete(account.id);
    console.error(`Could not load character ${characterId} for account ${account.id}: ${error.message}`);
    sendJoinFailed(socket, 'The server could not load that character. Try again.');
    return;
  }

  if (!character || socket.readyState !== WebSocket.OPEN) {
    accountsInWorld.delete(account.id);
    sendJoinFailed(socket, 'That character does not exist on your account.');
    return;
  }

  const { x, y, z, rotation } = world.addPlayer(playerId, character.name, character.faction, character.level);
  socket.send(JSON.stringify({ type: 'welcome', id: playerId, faction: character.faction, x, y, z, rotation }));
}

// Every player in the world receives every message, across both factions, like one global channel.
function handleChat({ socket, playerId }, text) {
  const player = world.getEntity(playerId);
  if (!player) return;

  const { text: cleanedText, error } = cleanChatMessage(text);
  if (error) {
    sendChatFailed(socket, error);
    return;
  }
  if (!chatRateLimiter.tryToSend(playerId, Date.now())) {
    sendChatFailed(socket, 'You are sending messages too fast. Wait a moment, then try again.');
    return;
  }

  broadcast({ type: 'chat', senderName: player.name, text: cleanedText });
}

function sendChatFailed(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'chatFailed', message }));
}

function sendJoinFailed(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'joinFailed', message }));
}

// Turning on the spot also sends a move. Only a change of position, including a jump, interrupts a cast.
function handleMove(playerId, position) {
  const before = world.getEntity(playerId);
  if (!world.movePlayer(playerId, position)) return;

  const after = world.getEntity(playerId);
  if (after.x !== before.x || after.y !== before.y || after.z !== before.z) combat.interruptCast(playerId);
}

function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const client of socketServer.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function createRequestHandler(databasePool, handleApiRequest) {
  return async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      await respondWithHealth(response, databasePool);
      return;
    }
    if (request.url.startsWith('/api/')) {
      await handleApiRequest(request, response);
      return;
    }

    sendText(
      response,
      404,
      'The game server has no page here. Open the game through nginx on http://localhost:8080, ' +
        'or through the Vite dev server on http://localhost:5173 during development.',
    );
  };
}

// Docker Compose uses this check to start nginx only after the server can reach the database.
async function respondWithHealth(response, databasePool) {
  try {
    await databasePool.query('SELECT 1');
    sendText(response, 200, 'ok');
  } catch (error) {
    console.error(`The health check could not reach the database: ${error.message}`);
    sendText(response, 503, 'The server cannot reach the database.');
  }
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(`${text}\n`);
}

async function start() {
  const databasePool = createDatabasePool(process.env.DATABASE_URL);
  await connectWithRetry(databasePool);
  await runMigrations(databasePool, MIGRATIONS_DIRECTORY);

  const accountStore = createAccountStore(databasePool);
  const characterStore = createCharacterStore(databasePool);
  const handleApiRequest = createApi({
    accountStore,
    characterStore,
    secureCookies: process.env.SECURE_COOKIES === 'true',
  });
  httpServer.on('request', createRequestHandler(databasePool, handleApiRequest));
  httpServer.on('upgrade', (request, socket, head) =>
    handleUpgrade(request, socket, head, { accountStore, characterStore }),
  );

  const tickTimer = setInterval(() => {
    combat.tick(Date.now());
    broadcast({ type: 'snapshot', entities: world.snapshot() });
  }, TICK_INTERVAL_MS);

  httpServer.listen(PORT, () => {
    console.log(`Questforge server listening on http://localhost:${PORT}`);
  });

  const shutDown = async (signal) => {
    console.log(`Received ${signal}. The server is shutting down.`);
    clearInterval(tickTimer);
    for (const client of socketServer.clients) client.close(1001, 'The server is shutting down.');
    socketServer.close();
    httpServer.close();
    await databasePool.end();
    process.exit(0);
  };
  process.once('SIGTERM', shutDown);
  process.once('SIGINT', shutDown);
}

start().catch((error) => {
  console.error(`The server could not start. ${error.message}`);
  process.exit(1);
});
