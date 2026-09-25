import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRelationship } from '../factions.js';

const dawnguardAlice = { id: 'alice', faction: 'dawnguard' };

test('an entity is itself', () => {
  assert.equal(getRelationship(dawnguardAlice, dawnguardAlice), 'self');
});

test('entities in the same faction are friendly', () => {
  assert.equal(getRelationship(dawnguardAlice, { id: 'bob', faction: 'dawnguard' }), 'friendly');
});

test('entities in different factions are hostile', () => {
  assert.equal(getRelationship(dawnguardAlice, { id: 'bob', faction: 'emberclaw' }), 'hostile');
});

test('an entity without a faction is hostile to a player', () => {
  assert.equal(getRelationship(dawnguardAlice, { id: 'dummy', faction: null }), 'hostile');
});

test('two entities without a faction are hostile to each other', () => {
  assert.equal(getRelationship({ id: 'wolf', faction: null }, { id: 'dummy', faction: null }), 'hostile');
});
