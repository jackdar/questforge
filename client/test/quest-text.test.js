import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeObjectives, describeProgressChanges } from '../src/quest-text.js';

test('a kill objective shows the creature name and the kill count', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [2] } };

  assert.deepEqual(describeObjectives('wolvesAtTheDoor', questLog, []), [
    { text: 'Grey Wolf slain: 2/5', isMet: false },
  ]);
});

test('a collect objective shows the item name and the count in the bags', () => {
  const questLog = {
    wolvesAtTheDoor: { status: 'completed', progress: [5] },
    peltsForTheTanner: { status: 'active', progress: [] },
  };
  const stacks = [{ slot: 0, itemId: 'wolfPelt', quantity: 3 }];

  assert.deepEqual(describeObjectives('peltsForTheTanner', questLog, stacks), [
    { text: 'Wolf Pelt: 3/3', isMet: true },
  ]);
});

test('a talk quest shows the NPC to speak to, and the line stays open until the quest is completed', () => {
  const questLog = { wordToTheRanger: { status: 'active', progress: [] } };

  assert.deepEqual(describeObjectives('wordToTheRanger', questLog, []), [
    { text: 'Speak to Ranger Ashby', isMet: false },
  ]);
});

const peltsQuestActive = {
  wolvesAtTheDoor: { status: 'completed', progress: [5] },
  peltsForTheTanner: { status: 'active', progress: [] },
};

test('a new kill shows the new kill count', () => {
  const before = { questLog: { wolvesAtTheDoor: { status: 'active', progress: [2] } }, stacks: [] };
  const after = { questLog: { wolvesAtTheDoor: { status: 'active', progress: [3] } }, stacks: [] };

  assert.deepEqual(describeProgressChanges(before, after), ['Grey Wolf slain: 3/5']);
});

test('the kill that finishes a quest also shows that the quest is complete', () => {
  const before = { questLog: { wolvesAtTheDoor: { status: 'active', progress: [4] } }, stacks: [] };
  const after = { questLog: { wolvesAtTheDoor: { status: 'active', progress: [5] } }, stacks: [] };

  assert.deepEqual(describeProgressChanges(before, after), ['Grey Wolf slain: 5/5', 'Wolves at the Door (Complete)']);
});

test('a looted quest item shows the new item count', () => {
  const before = { questLog: peltsQuestActive, stacks: [] };
  const after = { questLog: peltsQuestActive, stacks: [{ slot: 0, itemId: 'wolfPelt', quantity: 1 }] };

  assert.deepEqual(describeProgressChanges(before, after), ['Wolf Pelt: 1/3']);
});

test('a newly accepted quest shows no progress, even a talk quest that is done at once', () => {
  const before = { questLog: {}, stacks: [] };
  const after = { questLog: { wordToTheRanger: { status: 'active', progress: [] } }, stacks: [] };

  assert.deepEqual(describeProgressChanges(before, after), []);
});

test('an item that does not count for a quest shows no progress', () => {
  const before = { questLog: peltsQuestActive, stacks: [] };
  const after = { questLog: peltsQuestActive, stacks: [{ slot: 0, itemId: 'wolfFang', quantity: 1 }] };

  assert.deepEqual(describeProgressChanges(before, after), []);
});
