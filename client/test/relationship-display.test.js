import { test } from 'node:test';
import assert from 'node:assert/strict';
import { displayRelationship } from '../src/relationship-display.js';

const alice = { id: 'alice', kind: 'player', faction: 'dawnguard' };

test('a neutral creature shows as neutral', () => {
  assert.equal(displayRelationship(alice, { id: 'wolf-1', kind: 'wolf', faction: null }), 'neutral');
});

test('an aggressive creature shows as hostile', () => {
  assert.equal(displayRelationship(alice, { id: 'bandit-1', kind: 'bandit', faction: null }), 'hostile');
});

test('a player of the same faction shows as friendly', () => {
  assert.equal(displayRelationship(alice, { id: 'bob', kind: 'player', faction: 'dawnguard' }), 'friendly');
});
