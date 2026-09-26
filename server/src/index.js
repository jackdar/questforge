import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { createParties, playersSharingKill } from './parties.js';
import { createMapInstance } from './map-instance.js';
import { createInstances } from './instances.js';
import { loginPlaceFor } from './login-place.js';
import { loadOverworldHeightGrid } from './overworld-map.js';
import { portalAt } from 'questforge-shared/maps.js';
import { createDatabasePool, connectWithRetry, runMigrations } from './database.js';
import { createAccountStore } from './account-store.js';
import { createCharacterStore } from './character-store.js';
import { createInventoryStore } from './inventory-store.js';
import { createQuestStore } from './quest-store.js';
import { createShopStore } from './shop-store.js';
import { createApi } from './api.js';
import { readSessionToken, isSameOriginRequest } from './session-cookie.js';
import { createChatRateLimiter } from './chat-rate-limit.js';
import { cleanChatMessage } from 'questforge-shared/chat-rules.js';
import { addToBags, moveStack } from 'questforge-shared/inventory-rules.js';
import { addToBuyback } from 'questforge-shared/shop-rules.js';
import { INTERACT_RANGE, NPCS } from 'questforge-shared/npcs.js';
import { QUESTS } from 'questforge-shared/quests.js';
import { killXp } from 'questforge-shared/leveling.js';

const PORT = Number(process.env.PORT ?? 3030);
const TICK_INTERVAL_MS = 50;
const POSITION_SAVE_INTERVAL_MS = 30000;
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));

const httpServer = createServer();

const socketServer = new WebSocketServer({ noServer: true });
const parties = createParties();
const connectionsByPlayerId = new Map();
// The overworld instance reads its terrain when the server makes it, so the height grid must load first.
const usesBlenderOverworld = await loadOverworldHeightGrid();
console.log(`The overworld uses the ${usesBlenderOverworld ? 'Blender map height grid' : 'calculated terrain'}.`);

// Each connection keeps the map instance that its player is in, and every game message acts on that instance.
const instances = createInstances({
  parties,
  createInstance: (options) =>
    createMapInstance({ ...options, parties, sendToPlayers, onTaggedKill: handleTaggedKill }),
});
const accountsInWorld = new Set();
const chatRateLimiter = createChatRateLimiter();

// Only a logged-in account can open a game connection. The session cookie comes with the WebSocket handshake.
async function handleUpgrade(request, socket, head, stores) {
  const { accountStore } = stores;
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
    handleConnection({ socket: webSocket, playerId: randomUUID(), account, ...stores }),
  );
}

function rejectUpgrade(socket, statusCode, statusText) {
  socket.end(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
}

function handleConnection(connection) {
  const { socket, playerId, account } = connection;

  socket.on('message', (data) => handleMessage(connection, data));
  socket.on('close', () => {
    leaveParty(playerId);
    saveLastPosition(connection);
    if (connection.instance) {
      connection.instance.removePlayer(playerId, Date.now());
      accountsInWorld.delete(account.id);
    }
    connectionsByPlayerId.delete(playerId);
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
  if (message?.type === 'openLoot') handleOpenLoot(connection, message.entityId);
  if (message?.type === 'takeLoot') handleTakeLoot(connection, message.entityId, message.slot);
  if (message?.type === 'takeLootMoney') handleTakeLootMoney(connection, message.entityId);
  if (message?.type === 'buyItem') handleBuyItem(connection, message.npcId, message.itemId);
  if (message?.type === 'sellItem') handleSellItem(connection, message.npcId, message.slot);
  if (message?.type === 'buyBackItem') handleBuyBackItem(connection, message.npcId, message.saleId);
  if (message?.type === 'moveItem') handleMoveItem(connection, message.fromSlot, message.toSlot);
  if (message?.type === 'invitePlayer') handleInvitePlayer(connection, message.targetId);
  if (message?.type === 'respondToPartyInvite') handleRespondToPartyInvite(connection, message.accepts === true);
  if (message?.type === 'leaveParty') leaveParty(playerId);
  if (message?.type === 'acceptQuest') handleAcceptQuest(connection, message.questId);
  if (message?.type === 'abandonQuest') handleAbandonQuest(connection, message.questId);
  if (message?.type === 'turnInQuest') handleTurnInQuest(connection, message.questId);
  if (message?.type === 'move') handleMove(connection, message);
  if (message?.type === 'stopAttack') connection.instance?.combat.stopAutoAttack(playerId);
  if (message?.type === 'chat') handleChat(connection, message.text);
  if (message?.type === 'ping' && Number.isFinite(message.sentAt)) {
    socket.send(JSON.stringify({ type: 'pong', sentAt: message.sentAt }));
  }

  if (message?.type === 'cast' && connection.instance) {
    const targetId = typeof message.targetId === 'string' ? message.targetId : null;
    const result = connection.instance.combat.startCast(playerId, message.spellId, targetId, Date.now());
    if (!result.ok) socket.send(JSON.stringify({ type: 'castFailed', message: result.message }));
  }
}

// An account can have only one character in the world at a time.
async function handleJoin(connection, characterId) {
  const { socket, playerId, account, characterStore } = connection;
  if (connection.instance) return;
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

  connection.characterId = character.id;
  connection.characterName = character.name;
  connectionsByPlayerId.set(playerId, connection);
  let lastPosition = null;
  try {
    lastPosition = await characterStore.findLastPosition(character.id);
  } catch (error) {
    console.error(`Could not load the last position of character ${character.id}: ${error.message}`);
  }
  connection.instance = instances.overworld;
  const { x, y, z, rotation } = connection.instance.addPlayer(playerId, character, loginPlaceFor(lastPosition));
  // The server time lets the client show the same time of day as every other player.
  const serverTime = Date.now();
  const mapId = connection.instance.mapId;
  const welcome = { type: 'welcome', id: playerId, faction: character.faction, mapId, x, y, z, rotation, serverTime };
  socket.send(JSON.stringify(welcome));
  await sendInventory(connection);
  await sendQuestLog(connection);
  await sendExperience(connection);
  await sendMoney(connection);
}

// Every player in the world receives every message, across both factions, like one global channel.
function handleChat({ socket, playerId, instance, characterName }, text) {
  if (!instance) return;

  const { text: cleanedText, error } = cleanChatMessage(text);
  if (error) {
    sendChatFailed(socket, error);
    return;
  }
  if (!chatRateLimiter.tryToSend(playerId, Date.now())) {
    sendChatFailed(socket, 'You are sending messages too fast. Wait a moment, then try again.');
    return;
  }

  broadcast({ type: 'chat', senderName: characterName, text: cleanedText });
}

function sendChatFailed(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'chatFailed', message }));
}

// As in WoW, the player must stand next to the quest giver to accept a quest.
async function handleAcceptQuest(connection, questId) {
  const { socket, characterId, questStore } = connection;
  if (!characterId || typeof questId !== 'string') return;
  const giverId = Object.hasOwn(QUESTS, questId) ? QUESTS[questId].giver : null;
  if (!isNextToEntity(connection, giverId)) {
    sendToPlayer(socket, { type: 'questFailed', message: 'You are too far away.' });
    return;
  }

  await changeQuestLog(socket, characterId, () => questStore.acceptQuest(characterId, questId));
}

// The player must stand next to the NPC that takes the quest back, which for a talk quest is not the giver.
async function handleTurnInQuest(connection, questId) {
  const { socket, playerId, characterId, questStore } = connection;
  const xpGained = Object.hasOwn(QUESTS, questId) ? QUESTS[questId].rewards.xp : 0;
  if (!characterId || typeof questId !== 'string') return;
  const turnInId = Object.hasOwn(QUESTS, questId) ? QUESTS[questId].turnIn : null;
  if (!isNextToEntity(connection, turnInId)) {
    sendToPlayer(socket, { type: 'questFailed', message: 'You are too far away.' });
    return;
  }

  let result;
  try {
    result = await questStore.turnInQuest(characterId, questId);
  } catch (error) {
    console.error(`Could not turn in quest ${questId} for character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'questFailed', message: 'The server could not turn in that quest. Try again.' });
    return;
  }
  if (result.error) {
    sendToPlayer(socket, { type: 'questFailed', message: result.error });
    return;
  }

  connection.instance.world.setLevel(playerId, result.experience.level);
  sendToPlayer(socket, { type: 'inventory', stacks: result.stacks });
  sendToPlayer(socket, { type: 'questLog', quests: result.questLog });
  sendToPlayer(socket, { type: 'questCompleted', questId });
  sendToPlayer(socket, { type: 'experience', ...result.experience, xpGained });
}

async function handleAbandonQuest({ socket, characterId, questStore }, questId) {
  if (!characterId || typeof questId !== 'string') return;
  await changeQuestLog(socket, characterId, () => questStore.abandonQuest(characterId, questId));
}

async function changeQuestLog(socket, characterId, change) {
  let result;
  try {
    result = await change();
  } catch (error) {
    console.error(`Could not change the quest log of character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'questFailed', message: 'The server could not save your quest log. Try again.' });
    return;
  }

  if (result.error) sendToPlayer(socket, { type: 'questFailed', message: result.error });
  else sendToPlayer(socket, { type: 'questLog', quests: result.questLog });
}

// Every party member near the kill gets quest credit and an even share of the xp, as in WoW. Each share is worked
// out for the level of that member, so a grey kill still gives a low-level member some xp.
async function handleTaggedKill(instance, { taggerId, creatureKind, level, maxHealth, x, z }) {
  const sharers = playersSharingKill(taggerId, { x, z }, instance.world, parties);
  await Promise.all(sharers.map((member) => creditKill(member, sharers.length, { creatureKind, level, maxHealth })));
}

async function creditKill(member, shareCount, { creatureKind, level, maxHealth }) {
  const connection = connectionsByPlayerId.get(member.id);
  if (!connection) return;
  const { socket, characterId, questStore } = connection;

  const xpGained = Math.round(killXp({ level, maxHealth }, member.level) / shareCount);
  if (xpGained > 0) await giveKillXp(connection, member.id, xpGained);

  try {
    const { questLog } = await questStore.recordKill(characterId, creatureKind);
    if (questLog) sendToPlayer(socket, { type: 'questLog', quests: questLog });
  } catch (error) {
    console.error(`Could not save quest kill credit for character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'questFailed', message: 'The server could not save your quest progress.' });
  }
}

function handleInvitePlayer({ socket, playerId, instance }, targetId) {
  if (typeof targetId !== 'string' || !instance) return;
  const inviter = instance.world.getEntity(playerId);
  const invitee = instance.world.getEntity(targetId);
  if (!inviter) return;

  const result = parties.invite(inviter, invitee, Date.now());
  if (result.error) {
    sendToPlayer(socket, { type: 'partyFailed', message: result.error });
    return;
  }
  sendToPlayer(connectionsByPlayerId.get(targetId)?.socket, { type: 'partyInvite', inviterName: inviter.name });
  sendToPlayer(socket, { type: 'partyNotice', message: `You invite ${invitee.name} to join your party.` });
}

function handleRespondToPartyInvite({ socket, playerId, instance }, accepts) {
  const invitee = instance?.world.getEntity(playerId);
  if (!invitee) return;

  const result = parties.respond(invitee, accepts, Date.now());
  if (result.error) {
    sendToPlayer(socket, { type: 'partyFailed', message: result.error });
    return;
  }
  if (result.declinedInviter) {
    const message = `${invitee.name} declines your party invitation.`;
    sendToPlayer(connectionsByPlayerId.get(result.declinedInviter.id)?.socket, { type: 'partyNotice', message });
    return;
  }

  const memberIds = result.party.members.map((member) => member.id);
  sendToPlayers(memberIds, { type: 'party', party: result.party });
  sendToPlayers(memberIds, { type: 'partyNotice', message: `${invitee.name} joins the party.` });
}

// A party of one is no party, so the last member left gets an empty party too.
function leaveParty(playerId) {
  const name = connectionsByPlayerId.get(playerId)?.characterName;
  const { remainingParty, formerMemberIds } = parties.leave(playerId);
  if (formerMemberIds.length === 0) return;

  sendToPlayer(connectionsByPlayerId.get(playerId)?.socket, { type: 'party', party: null });
  sendToPlayers(formerMemberIds, { type: 'party', party: remainingParty });
  sendToPlayers(formerMemberIds, { type: 'partyNotice', message: `${name} leaves the party.` });
}

// The message is turned into text once, because a snapshot goes to every player in an instance on every tick.
function sendToPlayers(playerIds, message) {
  const payload = JSON.stringify(message);
  for (const id of playerIds) {
    const socket = connectionsByPlayerId.get(id)?.socket;
    if (socket?.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

// A player who walks into a portal leaves their map instance and enters the instance of the other map for their
// party, at the arrival point of the portal. The client then unloads the old map and loads the new one.
function moveThroughPortals(now) {
  for (const connection of connectionsByPlayerId.values()) {
    const { instance, playerId } = connection;
    const player = instance?.world.getEntity(playerId);
    if (!player || player.health === 0) continue;
    const portal = portalAt(instance.mapId, player);
    if (portal) movePlayerToMap(connection, portal, now);
  }
}

function movePlayerToMap(connection, { toMapId, arrival }, now) {
  const { playerId, socket } = connection;
  const player = connection.instance.world.getEntity(playerId);
  const character = { name: player.name, faction: player.faction, level: player.level };
  connection.instance.removePlayer(playerId, now);

  connection.instance = instances.instanceFor(toMapId, playerId);
  const { x, y, z, rotation } = connection.instance.addPlayer(playerId, character, arrival);
  sendToPlayer(socket, { type: 'mapChanged', mapId: toMapId, x, y, z, rotation });
}

// A creature far below the player is grey and gives no xp, so the caller skips the save for it.
// The player can walk through a portal while the save runs, so the level goes to the instance the player is in now.
async function giveKillXp(connection, playerId, xpGained) {
  const { socket, characterId, characterStore } = connection;
  try {
    const { experience } = await characterStore.gainXp(characterId, xpGained);
    connection.instance?.world.setLevel(playerId, experience.level);
    sendToPlayer(socket, { type: 'experience', ...experience, xpGained });
  } catch (error) {
    console.error(`Could not save kill xp for character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'questFailed', message: 'The server could not save your experience.' });
  }
}

async function sendMoney({ socket, characterId, characterStore }) {
  try {
    sendToPlayer(socket, { type: 'money', copper: await characterStore.findCopper(characterId) });
  } catch (error) {
    console.error(`Could not load the money of character ${characterId}: ${error.message}`);
    const message = 'The server could not load your money. Reload to try again.';
    sendToPlayer(socket, { type: 'inventoryFailed', message });
  }
}

async function sendExperience({ socket, characterId, characterStore }) {
  try {
    sendToPlayer(socket, { type: 'experience', ...(await characterStore.findExperience(characterId)), xpGained: 0 });
  } catch (error) {
    console.error(`Could not load the experience of character ${characterId}: ${error.message}`);
    const message = 'The server could not load your experience. Reload to try again.';
    sendToPlayer(socket, { type: 'questFailed', message });
  }
}

async function sendQuestLog({ socket, characterId, questStore }) {
  try {
    sendToPlayer(socket, { type: 'questLog', quests: await questStore.listQuestLog(characterId) });
  } catch (error) {
    console.error(`Could not load the quest log of character ${characterId}: ${error.message}`);
    const message = 'The server could not load your quests. Reload to try again.';
    sendToPlayer(socket, { type: 'questFailed', message });
  }
}

function isNextToEntity({ playerId, instance }, entityId) {
  if (!instance || entityId === null) return false;
  const player = instance.world.getEntity(playerId);
  const entity = instance.world.getEntity(entityId);
  if (!player || !entity) return false;
  return Math.hypot(entity.x - player.x, entity.z - player.z) <= INTERACT_RANGE;
}

function handleOpenLoot({ socket, playerId, instance }, corpseId) {
  if (typeof corpseId !== 'string' || !instance) return;
  const { drops, copper, error } = instance.loot.openLoot(playerId, corpseId);
  if (error) sendToPlayer(socket, { type: 'lootFailed', message: error });
  else sendToPlayer(socket, { type: 'lootWindow', entityId: corpseId, drops, copper });
}

async function handleTakeLoot(connection, corpseId, slot) {
  const { socket, playerId, characterId, inventoryStore, instance } = connection;
  if (typeof corpseId !== 'string' || !Number.isInteger(slot) || !instance) return;
  const { loot } = instance;
  const { drop, error } = loot.takeDrop(playerId, corpseId, slot);
  if (error) {
    sendToPlayer(socket, { type: 'lootFailed', message: error });
    return;
  }

  let result;
  try {
    result = await inventoryStore.changeStacks(characterId, (stacks) => addToBags(stacks, drop));
  } catch (saveError) {
    loot.returnDrop(corpseId, drop);
    console.error(`Could not save item ${drop.itemId} for character ${characterId}: ${saveError.message}`);
    sendToPlayer(socket, { type: 'lootFailed', message: 'The server could not save that item. Try again.' });
    return;
  }
  // The bags are full, so the item stays on the corpse.
  if (result.error) {
    loot.returnDrop(corpseId, drop);
    sendToPlayer(socket, { type: 'lootFailed', message: result.error });
    return;
  }

  sendToPlayer(socket, { type: 'lootReceived', itemId: drop.itemId, quantity: drop.quantity });
  sendLootWindow(socket, loot, corpseId);
  sendToPlayer(socket, { type: 'inventory', stacks: result.stacks });
}

// Every shop action needs the player to stand next to the NPC that runs the shop.
function findShopNextToPlayer(connection, npcId) {
  const { socket, characterId } = connection;
  if (!characterId || typeof npcId !== 'string') return null;
  const shopId = Object.hasOwn(NPCS, npcId) ? NPCS[npcId].shopId : undefined;
  if (!shopId || !isNextToEntity(connection, npcId)) {
    sendToPlayer(socket, { type: 'shopFailed', message: 'You are too far away.' });
    return null;
  }
  return shopId;
}

// Returns the result of the shop change, or null after it tells the player why the change failed.
async function runShopChange(socket, characterId, change) {
  let result;
  try {
    result = await change();
  } catch (error) {
    console.error(`A shop change failed for character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'shopFailed', message: 'The server could not complete that trade. Try again.' });
    return null;
  }
  if (result.error) {
    sendToPlayer(socket, { type: 'shopFailed', message: result.error });
    return null;
  }
  sendToPlayer(socket, { type: 'inventory', stacks: result.stacks });
  sendToPlayer(socket, { type: 'money', copper: result.copper });
  return result;
}

async function handleBuyItem(connection, npcId, itemId) {
  const { socket, characterId, shopStore } = connection;
  const shopId = findShopNextToPlayer(connection, npcId);
  if (!shopId || typeof itemId !== 'string') return;

  const result = await runShopChange(socket, characterId, () => shopStore.buyItem(characterId, shopId, itemId));
  if (result) sendToPlayer(socket, { type: 'itemBought', itemId });
}

// The buyback list lives on the connection, so it lasts for this session only, as in WoW.
async function handleSellItem(connection, npcId, slot) {
  const { socket, characterId, shopStore } = connection;
  if (!findShopNextToPlayer(connection, npcId) || !Number.isInteger(slot)) return;

  const result = await runShopChange(socket, characterId, () => shopStore.sellStack(characterId, slot));
  if (!result) return;
  connection.nextSaleId = (connection.nextSaleId ?? 0) + 1;
  connection.buyback = addToBuyback(connection.buyback ?? [], { id: connection.nextSaleId, ...result.sale });
  sendToPlayer(socket, { type: 'itemSold', ...result.sale });
  sendToPlayer(socket, { type: 'buyback', sales: connection.buyback });
}

// The sale leaves the buyback list before the save, so that a second request cannot buy it back twice.
async function handleBuyBackItem(connection, npcId, saleId) {
  const { socket, characterId, shopStore } = connection;
  if (!findShopNextToPlayer(connection, npcId)) return;
  const sale = (connection.buyback ?? []).find((candidate) => candidate.id === saleId);
  if (!sale) {
    sendToPlayer(socket, { type: 'shopFailed', message: 'That item is no longer in the buyback list.' });
    return;
  }

  connection.buyback = connection.buyback.filter((candidate) => candidate !== sale);
  const result = await runShopChange(socket, characterId, () => shopStore.buyBack(characterId, sale));
  if (!result) connection.buyback = [sale, ...connection.buyback].sort((a, b) => b.id - a.id);
  sendToPlayer(socket, { type: 'buyback', sales: connection.buyback });
}

async function handleTakeLootMoney({ socket, playerId, characterId, characterStore, instance }, corpseId) {
  if (typeof corpseId !== 'string' || !instance) return;
  const { loot } = instance;
  const { copper, error } = loot.takeCopper(playerId, corpseId);
  if (error) {
    sendToPlayer(socket, { type: 'lootFailed', message: error });
    return;
  }

  let totalCopper;
  try {
    totalCopper = await characterStore.addCopper(characterId, copper);
  } catch (saveError) {
    loot.returnCopper(corpseId, copper);
    console.error(`Could not save looted money for character ${characterId}: ${saveError.message}`);
    sendToPlayer(socket, { type: 'lootFailed', message: 'The server could not save that money. Try again.' });
    return;
  }

  sendToPlayer(socket, { type: 'moneyLooted', copper });
  sendLootWindow(socket, loot, corpseId);
  sendToPlayer(socket, { type: 'money', copper: totalCopper });
}

function sendLootWindow(socket, loot, corpseId) {
  const drops = loot.getCorpseLoot(corpseId);
  sendToPlayer(socket, { type: 'lootWindow', entityId: corpseId, drops, copper: loot.getCorpseCopper(corpseId) });
}

async function handleMoveItem({ socket, characterId, inventoryStore }, fromSlot, toSlot) {
  if (!characterId) return;
  let result;
  try {
    result = await inventoryStore.changeStacks(characterId, (stacks) => moveStack(stacks, fromSlot, toSlot));
  } catch (error) {
    console.error(`Could not move an item in the bags of character ${characterId}: ${error.message}`);
    sendToPlayer(socket, { type: 'inventoryFailed', message: 'The server could not move that item. Try again.' });
    return;
  }

  if (result.error) sendToPlayer(socket, { type: 'inventoryFailed', message: result.error });
  else sendToPlayer(socket, { type: 'inventory', stacks: result.stacks });
}

// The database holds the inventory, so the bags always show what the server saved.
async function sendInventory({ socket, characterId, inventoryStore }) {
  try {
    sendToPlayer(socket, { type: 'inventory', stacks: await inventoryStore.listStacks(characterId) });
  } catch (error) {
    console.error(`Could not load the inventory of character ${characterId}: ${error.message}`);
    const message = 'The server could not load your bags. Reload to try again.';
    sendToPlayer(socket, { type: 'inventoryFailed', message });
  }
}

// The place is read at once, before the player leaves the world, and then saved in the background.
function saveLastPosition({ playerId, characterId, characterStore, instance }) {
  const player = instance?.world.getEntity(playerId);
  if (!player) return Promise.resolve();
  const position = { mapId: instance.mapId, x: player.x, z: player.z, rotation: player.rotation };
  return characterStore.saveLastPosition(characterId, position).catch((error) => {
    console.error(`Could not save the last position of character ${characterId}: ${error.message}`);
  });
}

function sendToPlayer(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function sendJoinFailed(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'joinFailed', message }));
}

// Turning on the spot also sends a move. Only a change of position, including a jump, interrupts a cast.
function handleMove({ playerId, instance }, position) {
  if (!instance) return;
  const { world, combat } = instance;
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
  const inventoryStore = createInventoryStore(databasePool);
  const questStore = createQuestStore(databasePool);
  const shopStore = createShopStore(databasePool);
  const handleApiRequest = createApi({
    accountStore,
    characterStore,
    secureCookies: process.env.SECURE_COOKIES === 'true',
  });
  httpServer.on('request', createRequestHandler(databasePool, handleApiRequest));
  httpServer.on('upgrade', (request, socket, head) =>
    handleUpgrade(request, socket, head, { accountStore, characterStore, inventoryStore, questStore, shopStore }),
  );

  const tickTimer = setInterval(() => {
    const now = Date.now();
    for (const instance of instances.all()) instance.tick(now);
    moveThroughPortals(now);
    instances.closeEmptyInstances(now);
  }, TICK_INTERVAL_MS);

  httpServer.listen(PORT, () => {
    console.log(`Questforge server listening on http://localhost:${PORT}`);
  });

  // A crash loses at most this much of each player's walk since the last save.
  const positionSaveTimer = setInterval(() => {
    for (const connection of connectionsByPlayerId.values()) saveLastPosition(connection);
  }, POSITION_SAVE_INTERVAL_MS);

  const shutDown = async (signal) => {
    console.log(`Received ${signal}. The server is shutting down.`);
    clearInterval(tickTimer);
    clearInterval(positionSaveTimer);
    await Promise.all([...connectionsByPlayerId.values()].map(saveLastPosition));
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
