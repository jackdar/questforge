import { randomBytes } from 'node:crypto';
import { validateUsername, validatePassword } from 'questforge-shared/account-rules.js';
import {
  validateCharacterName,
  validateFaction,
  formatCharacterName,
  STARTING_LEVEL,
} from 'questforge-shared/character-rules.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { SESSION_LIFETIME_SECONDS } from './account-store.js';
import { readSessionToken, createSessionCookie, createExpiredSessionCookie } from './session-cookie.js';

const MAX_BODY_BYTES = 10_000;
const WRONG_LOGIN_MESSAGE = 'Wrong username or password.';

class RequestError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function createApi({ accountStore, characterStore, secureCookies }) {
  // A login for an unknown username checks this hash, so that it takes as long as a login with a wrong password.
  // Otherwise the response time would tell an attacker which usernames exist.
  const unknownAccountPasswordHash = hashPassword(randomBytes(16).toString('hex'));

  const routes = {
    'POST /api/register': register,
    'POST /api/login': login,
    'POST /api/logout': logout,
    'GET /api/session': getSession,
    'GET /api/characters': listCharacters,
    'POST /api/characters': createCharacter,
  };

  return async function handleApiRequest(request, response) {
    const { pathname } = new URL(request.url, 'http://localhost');
    const route = routes[`${request.method} ${pathname}`];

    try {
      if (!route) throw new RequestError(404, 'That API route does not exist.');
      await route(request, response);
    } catch (error) {
      if (error instanceof RequestError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error(`The API request ${request.method} ${pathname} failed: ${error.stack}`);
      sendJson(response, 500, { error: 'The server could not complete the request. Try again later.' });
    }
  };

  async function register(request, response) {
    const { username, password } = await readJsonBody(request);
    const problem = validateUsername(username) ?? validatePassword(password);
    if (problem) throw new RequestError(400, problem);

    const { account, error } = await accountStore.createAccount(username, await hashPassword(password));
    if (error) throw new RequestError(409, error);

    await startSession(response, 201, account);
  }

  async function login(request, response) {
    const { username, password } = await readJsonBody(request);
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new RequestError(400, 'Enter a username and a password.');
    }

    const account = await accountStore.findAccountForLogin(username);
    const passwordHash = account?.passwordHash ?? (await unknownAccountPasswordHash);
    const isPasswordCorrect = await verifyPassword(password, passwordHash);
    if (!account || !isPasswordCorrect) throw new RequestError(401, WRONG_LOGIN_MESSAGE);

    await startSession(response, 200, { id: account.id, username: account.username });
  }

  async function logout(request, response) {
    await accountStore.deleteSession(readSessionToken(request));
    response.writeHead(204, { 'Set-Cookie': createExpiredSessionCookie({ secure: secureCookies }) });
    response.end();
  }

  async function getSession(request, response) {
    sendJson(response, 200, { account: await requireAccount(request) });
  }

  async function listCharacters(request, response) {
    const account = await requireAccount(request);
    sendJson(response, 200, { characters: await characterStore.listCharacters(account.id) });
  }

  async function createCharacter(request, response) {
    const account = await requireAccount(request);
    const { name, faction } = await readJsonBody(request);
    const problem = validateCharacterName(name) ?? validateFaction(faction);
    if (problem) throw new RequestError(400, problem);

    const { character, error } = await characterStore.createCharacter(account.id, {
      name: formatCharacterName(name),
      faction,
      level: STARTING_LEVEL,
    });
    if (error) throw new RequestError(409, error);
    sendJson(response, 201, { character });
  }

  async function requireAccount(request) {
    const account = await accountStore.findAccountBySession(readSessionToken(request));
    if (!account) throw new RequestError(401, 'You are not logged in.');
    return account;
  }

  async function startSession(response, statusCode, account) {
    const token = await accountStore.createSession(account.id);
    const cookie = createSessionCookie(token, { maxAgeSeconds: SESSION_LIFETIME_SECONDS, secure: secureCookies });
    sendJson(response, statusCode, { account }, { 'Set-Cookie': cookie });
  }
}

// Requiring a JSON content type also blocks a plain HTML form on another site from posting here.
async function readJsonBody(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) {
    throw new RequestError(415, 'Send the request body as JSON.');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RequestError(413, 'The request body is too large.');
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'The request body is not valid JSON.');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new RequestError(400, 'The request body must be a JSON object.');
  }
  return body;
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}
