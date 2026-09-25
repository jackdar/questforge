import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTS } from '../quests.js';
import { NPCS } from '../npcs.js';
import { ITEMS } from '../items.js';
import { CREATURES } from '../creatures.js';

const quests = Object.values(QUESTS);

test('every quest id matches its key', () => {
  for (const [key, quest] of Object.entries(QUESTS)) assert.equal(quest.id, key);
});

test('every quest giver and turn-in NPC exists', () => {
  for (const quest of quests) {
    assert.ok(NPCS[quest.giver], `${quest.id} giver`);
    assert.ok(NPCS[quest.turnIn], `${quest.id} turnIn`);
  }
});

test('every quest without objectives is turned in at a different NPC, so it is a talk quest', () => {
  for (const quest of quests.filter((candidate) => candidate.objectives.length === 0)) {
    assert.notEqual(quest.turnIn, quest.giver, quest.id);
  }
});

test('every objective names a creature or item that exists and a count of at least one', () => {
  for (const quest of quests) {
    for (const objective of quest.objectives) {
      if (objective.type === 'kill') assert.ok(CREATURES[objective.creatureKind], quest.id);
      else if (objective.type === 'collect') assert.ok(ITEMS[objective.itemId], quest.id);
      else assert.fail(`${quest.id} has an unknown objective type "${objective.type}"`);
      assert.ok(Number.isInteger(objective.count) && objective.count >= 1, quest.id);
    }
  }
});

test('every reward item exists', () => {
  for (const quest of quests) {
    for (const { itemId, quantity } of quest.rewards.items) {
      assert.ok(ITEMS[itemId], quest.id);
      assert.ok(quantity >= 1, quest.id);
    }
  }
});

test('every quest has a recommended level and a positive xp reward', () => {
  for (const quest of quests) {
    assert.ok(Number.isInteger(quest.recommendedLevel) && quest.recommendedLevel >= 1, quest.id);
    assert.ok(quest.rewards.xp > 0, quest.id);
  }
});

test('every required quest exists, and no chain loops back on itself', () => {
  function assertNoLoop(questId, chain) {
    assert.ok(QUESTS[questId], `${chain.at(-1)} requires the unknown quest ${questId}`);
    assert.ok(!chain.includes(questId), `The chain ${[...chain, questId].join(' > ')} loops`);
    for (const requiredId of QUESTS[questId].requires) assertNoLoop(requiredId, [...chain, questId]);
  }

  for (const quest of quests) assertNoLoop(quest.id, []);
});
