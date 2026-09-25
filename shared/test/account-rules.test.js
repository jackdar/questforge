import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername,
  validatePassword,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from '../account-rules.js';

test('a username of letters, numbers, and underscores is valid', () => {
  assert.equal(validateUsername('Sir_Loot_42'), null);
});

test('a username shorter than the minimum is not valid', () => {
  assert.match(validateUsername('a'.repeat(USERNAME_MIN_LENGTH - 1)), /must have 3 to 20 characters/);
});

test('a username longer than the maximum is not valid', () => {
  assert.match(validateUsername('a'.repeat(USERNAME_MAX_LENGTH + 1)), /must have 3 to 20 characters/);
});

test('a username with a space or symbol is not valid', () => {
  assert.match(validateUsername('sir loot'), /only letters, numbers, and underscores/);
  assert.match(validateUsername('sir-loot'), /only letters, numbers, and underscores/);
});

test('a username that is not a string is not valid', () => {
  assert.match(validateUsername(undefined), /must have 3 to 20 characters/);
});

test('a password with the minimum length is valid', () => {
  assert.equal(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH)), null);
});

test('a password shorter than the minimum is not valid', () => {
  assert.match(validatePassword('a'.repeat(PASSWORD_MIN_LENGTH - 1)), /at least 8 characters/);
});

test('a password longer than the maximum is not valid', () => {
  assert.match(validatePassword('a'.repeat(PASSWORD_MAX_LENGTH + 1)), /at most 128 characters/);
});
