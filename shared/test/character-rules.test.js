import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCharacterName,
  validateFaction,
  formatCharacterName,
  CHARACTER_NAME_MIN_LENGTH,
  CHARACTER_NAME_MAX_LENGTH,
} from '../character-rules.js';

test('a name of letters is valid', () => {
  assert.equal(validateCharacterName('Thrall'), null);
});

test('a name shorter than the minimum is not valid', () => {
  assert.match(validateCharacterName('a'.repeat(CHARACTER_NAME_MIN_LENGTH - 1)), /must have 2 to 12 letters/);
});

test('a name longer than the maximum is not valid', () => {
  assert.match(validateCharacterName('a'.repeat(CHARACTER_NAME_MAX_LENGTH + 1)), /must have 2 to 12 letters/);
});

test('a name with a number, space, or accented letter is not valid', () => {
  assert.match(validateCharacterName('Thrall2'), /only the letters A to Z/);
  assert.match(validateCharacterName('Sir Loot'), /only the letters A to Z/);
  assert.match(validateCharacterName('Zoë'), /only the letters A to Z/);
});

test('a listed faction is valid', () => {
  assert.equal(validateFaction('emberclaw'), null);
});

test('an unknown faction or a built-in object key is not valid', () => {
  assert.equal(validateFaction('gnomes'), 'Choose one of the listed factions.');
  assert.equal(validateFaction('toString'), 'Choose one of the listed factions.');
  assert.equal(validateFaction(undefined), 'Choose one of the listed factions.');
});

test('a formatted name has a capital first letter and small letters after it', () => {
  assert.equal(formatCharacterName('tHRALL'), 'Thrall');
});
