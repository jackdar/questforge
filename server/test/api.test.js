import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/database.js';
import { createAccountStore } from '../src/account-store.js';
import { createCharacterStore } from '../src/character-store.js';
import { createApi } from '../src/api.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));
const jsonRequest = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
const alice = { username: 'Alice', password: 'correct horse battery' };

describe('API', databaseTestOptions, () => {
  let testSchema;
  let accountStore;
  let server;
  let baseUrl;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    accountStore = createAccountStore(testSchema.pool);
    server = createServer(
      createApi({ accountStore, characterStore: createCharacterStore(testSchema.pool), secureCookies: false }),
    );
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    server.close();
    await testSchema.drop();
  });

  test('registering creates an account and logs it in', async () => {
    const response = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = response.headers.get('set-cookie').split(';')[0];
    const sessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: sessionCookie } });

    assert.equal(response.status, 201);
    assert.equal((await response.json()).account.username, 'Alice');
    assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    assert.equal((await sessionResponse.json()).account.username, 'Alice');
  });

  test('registering stores a password hash and a session token hash, never the plain values', async () => {
    const response = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const token = response.headers.get('set-cookie').split(';')[0].split('=')[1];

    const { rows: accounts } = await testSchema.pool.query('SELECT password_hash FROM accounts');
    const { rows: sessions } = await testSchema.pool.query('SELECT token_hash FROM sessions');
    assert.doesNotMatch(accounts[0].password_hash, /correct horse battery/);
    assert.notEqual(sessions[0].token_hash, token);
  });

  test('registering with a username that breaks the rules fails with the rule', async () => {
    const response = await fetch(`${baseUrl}/api/register`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, username: 'a b' }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /only letters, numbers, and underscores/);
  });

  test('registering with a short password fails with the rule', async () => {
    const response = await fetch(`${baseUrl}/api/register`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, password: 'short' }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /at least 8 characters/);
  });

  test('registering a username that differs from a taken one only in case fails', async () => {
    await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });

    const response = await fetch(`${baseUrl}/api/register`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, username: 'aLiCe' }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'That username is taken.' });
  });

  test('logging in with the correct password starts a session', async () => {
    await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });

    const response = await fetch(`${baseUrl}/api/login`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, username: 'alice' }),
    });
    const sessionCookie = response.headers.get('set-cookie').split(';')[0];
    const sessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: sessionCookie } });

    assert.equal(response.status, 200);
    assert.equal((await sessionResponse.json()).account.username, 'Alice');
  });

  test('logging in with a wrong password and with an unknown username give the same answer', async () => {
    await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });

    const wrongPassword = await fetch(`${baseUrl}/api/login`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, password: 'wrong horse battery' }),
    });
    const unknownUsername = await fetch(`${baseUrl}/api/login`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, username: 'Nobody' }),
    });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUsername.status, 401);
    assert.deepEqual(await wrongPassword.json(), { error: 'Wrong username or password.' });
    assert.deepEqual(await unknownUsername.json(), { error: 'Wrong username or password.' });
    assert.equal(wrongPassword.headers.get('set-cookie'), null);
  });

  test('logging out ends the session and tells the browser to delete the cookie', async () => {
    const registerResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = registerResponse.headers.get('set-cookie').split(';')[0];

    const logoutResponse = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { Cookie: sessionCookie } });
    const sessionResponse = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: sessionCookie } });

    assert.equal(logoutResponse.status, 204);
    assert.match(logoutResponse.headers.get('set-cookie'), /Max-Age=0/);
    assert.equal(sessionResponse.status, 401);
  });

  test('an expired session does not log anyone in', async () => {
    const { account } = await accountStore.createAccount('Alice', 'not-a-real-hash');
    const token = await accountStore.createSession(account.id, { lifetimeSeconds: -1 });

    const response = await fetch(`${baseUrl}/api/session`, { headers: { Cookie: `questforge_session=${token}` } });

    assert.equal(response.status, 401);
  });

  test('asking for the session without a cookie says that nobody is logged in', async () => {
    const response = await fetch(`${baseUrl}/api/session`);

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'You are not logged in.' });
  });

  test('a body that is not JSON fails', async () => {
    const response = await fetch(`${baseUrl}/api/login`, { ...jsonRequest, body: '{not json' });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'The request body is not valid JSON.' });
  });

  test('a body sent as a form instead of JSON fails', async () => {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=Alice&password=correct',
    });

    assert.equal(response.status, 415);
  });

  test('creating a character gives it a formatted name and the starting level', async () => {
    const registerResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = registerResponse.headers.get('set-cookie').split(';')[0];

    const response = await fetch(`${baseUrl}/api/characters`, {
      ...jsonRequest,
      headers: { ...jsonRequest.headers, Cookie: sessionCookie },
      body: JSON.stringify({ name: 'tHRALL', faction: 'emberclaw' }),
    });

    assert.equal(response.status, 201);
    const { character } = await response.json();
    assert.deepEqual({ ...character, id: undefined }, { id: undefined, name: 'Thrall', faction: 'emberclaw', level: 1 });
  });

  test('the character list shows only the characters of the logged-in account', async () => {
    const aliceResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const aliceCookie = aliceResponse.headers.get('set-cookie').split(';')[0];
    const bobResponse = await fetch(`${baseUrl}/api/register`, {
      ...jsonRequest,
      body: JSON.stringify({ ...alice, username: 'Bob' }),
    });
    const bobCookie = bobResponse.headers.get('set-cookie').split(';')[0];
    for (const [cookie, name] of [
      [aliceCookie, 'Aria'],
      [aliceCookie, 'Brom'],
      [bobCookie, 'Cato'],
    ]) {
      await fetch(`${baseUrl}/api/characters`, {
        ...jsonRequest,
        headers: { ...jsonRequest.headers, Cookie: cookie },
        body: JSON.stringify({ name, faction: 'dawnguard' }),
      });
    }

    const response = await fetch(`${baseUrl}/api/characters`, { headers: { Cookie: aliceCookie } });

    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).characters.map((character) => character.name),
      ['Aria', 'Brom'],
    );
  });

  test('creating a character with a name that differs from a taken one only in case fails', async () => {
    const registerResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = registerResponse.headers.get('set-cookie').split(';')[0];
    const createRequest = { ...jsonRequest, headers: { ...jsonRequest.headers, Cookie: sessionCookie } };
    await fetch(`${baseUrl}/api/characters`, { ...createRequest, body: JSON.stringify({ name: 'Thrall', faction: 'emberclaw' }) });

    const response = await fetch(`${baseUrl}/api/characters`, {
      ...createRequest,
      body: JSON.stringify({ name: 'THRALL', faction: 'dawnguard' }),
    });

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'That name is taken.' });
  });

  test('creating a character with a name that breaks the rules fails with the rule', async () => {
    const registerResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = registerResponse.headers.get('set-cookie').split(';')[0];

    const response = await fetch(`${baseUrl}/api/characters`, {
      ...jsonRequest,
      headers: { ...jsonRequest.headers, Cookie: sessionCookie },
      body: JSON.stringify({ name: 'Thrall2', faction: 'emberclaw' }),
    });

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /only the letters A to Z/);
  });

  test('creating a character in an unknown faction fails', async () => {
    const registerResponse = await fetch(`${baseUrl}/api/register`, { ...jsonRequest, body: JSON.stringify(alice) });
    const sessionCookie = registerResponse.headers.get('set-cookie').split(';')[0];

    const response = await fetch(`${baseUrl}/api/characters`, {
      ...jsonRequest,
      headers: { ...jsonRequest.headers, Cookie: sessionCookie },
      body: JSON.stringify({ name: 'Thrall', faction: 'gnomes' }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Choose one of the listed factions.' });
  });

  test('the character routes need a logged-in account', async () => {
    const listResponse = await fetch(`${baseUrl}/api/characters`);
    const createResponse = await fetch(`${baseUrl}/api/characters`, {
      ...jsonRequest,
      body: JSON.stringify({ name: 'Thrall', faction: 'emberclaw' }),
    });

    assert.equal(listResponse.status, 401);
    assert.equal(createResponse.status, 401);
  });

  test('a character is found only for the account that owns it', async () => {
    const characterStore = createCharacterStore(testSchema.pool);
    const { account: owner } = await accountStore.createAccount('Alice', 'not-a-real-hash');
    const { account: stranger } = await accountStore.createAccount('Bob', 'not-a-real-hash');
    const { character } = await characterStore.createCharacter(owner.id, { name: 'Thrall', faction: 'emberclaw', level: 1 });

    assert.deepEqual(await characterStore.findCharacterForAccount(character.id, owner.id), character);
    assert.equal(await characterStore.findCharacterForAccount(character.id, stranger.id), null);
    assert.equal(await characterStore.findCharacterForAccount('not-a-number', owner.id), null);
  });

  test('an unknown API route returns 404', async () => {
    const response = await fetch(`${baseUrl}/api/nothing-here`);

    assert.equal(response.status, 404);
  });
});
