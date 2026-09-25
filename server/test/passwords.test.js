import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../src/passwords.js';

test('the correct password matches its hash', async () => {
  const hash = await hashPassword('correct horse battery');

  assert.equal(await verifyPassword('correct horse battery', hash), true);
});

test('a wrong password does not match the hash', async () => {
  const hash = await hashPassword('correct horse battery');

  assert.equal(await verifyPassword('wrong horse battery', hash), false);
});

test('a hash does not contain the password', async () => {
  const hash = await hashPassword('correct horse battery');

  assert.doesNotMatch(hash, /correct horse battery/);
  assert.match(hash, /^scrypt\$/);
});

test('the same password gives a different hash each time', async () => {
  const firstHash = await hashPassword('correct horse battery');
  const secondHash = await hashPassword('correct horse battery');

  assert.notEqual(firstHash, secondHash);
});

test('a stored hash in an unknown format never matches', async () => {
  assert.equal(await verifyPassword('correct horse battery', 'plain:correct horse battery'), false);
});
