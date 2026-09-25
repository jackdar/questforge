import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyQuestTurnIn,
  canTurnInQuest,
  countKill,
  getNpcMarker,
  getNpcQuests,
  getObjectiveProgress,
  getQuestStatus,
} from '../quest-rules.js';

const noQuests = {};
const noStacks = [];
const firstQuestDone = { wolvesAtTheDoor: { status: 'completed', progress: [5] } };
const threePelts = [
  { slot: 0, itemId: 'wolfPelt', quantity: 2 },
  { slot: 4, itemId: 'wolfPelt', quantity: 1 },
];

test('a quest without required quests is available to a new character', () => {
  assert.equal(getQuestStatus('wolvesAtTheDoor', noQuests, noStacks), 'available');
});

test('a quest is unavailable until the character completes the quests it requires', () => {
  const firstQuestActive = { wolvesAtTheDoor: { status: 'active', progress: [5] } };

  assert.equal(getQuestStatus('peltsForTheTanner', noQuests, noStacks), 'unavailable');
  assert.equal(getQuestStatus('peltsForTheTanner', firstQuestActive, noStacks), 'unavailable');
  assert.equal(getQuestStatus('peltsForTheTanner', firstQuestDone, noStacks), 'available');
});

test('an accepted kill quest stays active until the kill count reaches the objective', () => {
  const partway = { wolvesAtTheDoor: { status: 'active', progress: [4] } };
  const done = { wolvesAtTheDoor: { status: 'active', progress: [5] } };

  assert.equal(getQuestStatus('wolvesAtTheDoor', partway, noStacks), 'active');
  assert.equal(getQuestStatus('wolvesAtTheDoor', done, noStacks), 'readyToTurnIn');
});

test('a collect objective counts the item across all bag stacks', () => {
  const questLog = { ...firstQuestDone, peltsForTheTanner: { status: 'active', progress: [] } };

  const progress = getObjectiveProgress('peltsForTheTanner', questLog, threePelts);

  assert.deepEqual(
    progress.map((objective) => objective.current),
    [3],
  );
  assert.equal(getQuestStatus('peltsForTheTanner', questLog, threePelts), 'readyToTurnIn');
});

test('objective progress never shows more than the objective count', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [9] } };

  assert.deepEqual(getObjectiveProgress('wolvesAtTheDoor', questLog, noStacks)[0].current, 5);
});

test('a talk quest stays active until the player completes it at the turn-in NPC, but it can be turned in', () => {
  const questLog = { wordToTheRanger: { status: 'active', progress: [] } };

  assert.equal(getQuestStatus('wordToTheRanger', questLog, noStacks), 'active');
  assert.equal(canTurnInQuest('wordToTheRanger', questLog, noStacks), true);
});

test('an active quest with unmet objectives cannot be turned in', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [4] } };

  assert.equal(canTurnInQuest('wolvesAtTheDoor', questLog, noStacks), false);
});

test('a quest giver with a new quest shows the available marker', () => {
  assert.equal(getNpcMarker('marshalRedpine', noQuests, noStacks), 'available');
  assert.equal(getNpcMarker('rangerAshby', noQuests, noStacks), null);
});

test('a quest giver whose quest is in progress shows the in-progress marker', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [1] } };

  assert.equal(getNpcMarker('marshalRedpine', questLog, noStacks), 'inProgress');
});

test('a quest giver whose quest is done shows the turn-in marker', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [5] } };

  assert.equal(getNpcMarker('marshalRedpine', questLog, noStacks), 'turnIn');
});

test('a talk quest shows the in-progress marker at the other NPC and no marker at the giver', () => {
  const questLog = {
    wolvesAtTheDoor: { status: 'completed', progress: [5] },
    peltsForTheTanner: { status: 'completed', progress: [] },
    wordToTheRanger: { status: 'active', progress: [] },
  };

  assert.equal(getNpcMarker('rangerAshby', questLog, noStacks), 'inProgress');
  assert.equal(getNpcMarker('marshalRedpine', questLog, noStacks), null);
});

test('an NPC lists the quests it offers and the quests it takes back', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [2] } };

  assert.deepEqual(getNpcQuests('marshalRedpine', noQuests, noStacks), [
    { questId: 'wolvesAtTheDoor', status: 'available' },
  ]);
  assert.deepEqual(getNpcQuests('marshalRedpine', questLog, noStacks), [
    { questId: 'wolvesAtTheDoor', status: 'active' },
  ]);
});

test('a kill of the right creature adds one to an active kill objective', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [2] } };

  assert.deepEqual(countKill(questLog, 'wolf'), { wolvesAtTheDoor: [3] });
});

test('the first kill for a quest starts its count at one', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [] } };

  assert.deepEqual(countKill(questLog, 'wolf'), { wolvesAtTheDoor: [1] });
});

test('a kill of another creature counts for nothing', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [2] } };

  assert.deepEqual(countKill(questLog, 'bear'), {});
});

test('a kill after the objective is met counts for nothing', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [5] } };

  assert.deepEqual(countKill(questLog, 'wolf'), {});
});

test('a kill does not count for a completed quest or a quest with only collect objectives', () => {
  const questLog = {
    wolvesAtTheDoor: { status: 'completed', progress: [5] },
    peltsForTheTanner: { status: 'active', progress: [] },
  };

  assert.deepEqual(countKill(questLog, 'wolf'), {});
});

test('one kill counts for every active quest that needs it', () => {
  const questLog = {
    wolvesAtTheDoor: { status: 'active', progress: [1] },
    thinTheHerd: { status: 'active', progress: [4] },
  };

  assert.deepEqual(countKill(questLog, 'wolf'), { wolvesAtTheDoor: [2], thinTheHerd: [5] });
});

test('a turn-in takes the collected items and gives the reward items', () => {
  const questLog = { ...firstQuestDone, peltsForTheTanner: { status: 'active', progress: [] } };
  const stacks = [
    { slot: 0, itemId: 'wolfPelt', quantity: 4 },
    { slot: 1, itemId: 'wolfFang', quantity: 1 },
  ];

  assert.deepEqual(applyQuestTurnIn('peltsForTheTanner', questLog, stacks), {
    stacks: [
      { slot: 0, itemId: 'wolfPelt', quantity: 1 },
      { slot: 1, itemId: 'wolfFang', quantity: 1 },
      { slot: 2, itemId: 'wornLeatherBoots', quantity: 1 },
    ],
  });
});

test('a quest that is not done cannot be turned in', () => {
  const questLog = { wolvesAtTheDoor: { status: 'active', progress: [4] } };

  assert.deepEqual(applyQuestTurnIn('wolvesAtTheDoor', questLog, noStacks), { error: 'That quest is not complete.' });
});

test('a quest cannot be turned in when its reward items do not fit into the bags', () => {
  const questLog = { ...firstQuestDone, peltsForTheTanner: { status: 'active', progress: [] } };
  const fullBags = Array.from({ length: 16 }, (_, slot) => ({ slot, itemId: 'wolfPelt', quantity: 20 }));

  assert.deepEqual(applyQuestTurnIn('peltsForTheTanner', questLog, fullBags), { error: 'Your bags are full.' });
});

test('the space that collected items free up can hold the reward items', () => {
  const questLog = { ...firstQuestDone, peltsForTheTanner: { status: 'active', progress: [] } };
  const fullBags = Array.from({ length: 16 }, (_, slot) => ({ slot, itemId: 'wolfFang', quantity: 1 }));
  fullBags[15] = { slot: 15, itemId: 'wolfPelt', quantity: 3 };

  const { stacks } = applyQuestTurnIn('peltsForTheTanner', questLog, fullBags);

  assert.deepEqual(stacks.at(-1), { slot: 15, itemId: 'wornLeatherBoots', quantity: 1 });
});

test('a talk quest turns in at the turn-in NPC with no items', () => {
  const questLog = { wordToTheRanger: { status: 'active', progress: [] } };

  assert.deepEqual(applyQuestTurnIn('wordToTheRanger', questLog, noStacks), { stacks: [] });
});

test('the bandit quest opens only after the alpha quest, which opens only after the wolf chain', () => {
  const chainDone = {
    wolvesAtTheDoor: { status: 'completed', progress: [5] },
    peltsForTheTanner: { status: 'completed', progress: [] },
    wordToTheRanger: { status: 'completed', progress: [] },
    thinTheHerd: { status: 'completed', progress: [8] },
  };
  const alphaDone = { ...chainDone, theAlpha: { status: 'completed', progress: [1] } };

  assert.equal(getQuestStatus('theAlpha', chainDone, noStacks), 'available');
  assert.equal(getQuestStatus('banditTrouble', chainDone, noStacks), 'unavailable');
  assert.equal(getQuestStatus('banditTrouble', alphaDone, noStacks), 'available');
});

test('a bandit quest counts thug kills and leader kills separately', () => {
  const questLog = { banditTrouble: { status: 'active', progress: [4, 0] } };

  assert.deepEqual(countKill(questLog, 'bandit'), { banditTrouble: [5, 0] });
  assert.deepEqual(countKill(questLog, 'banditLeader'), { banditTrouble: [4, 1] });
});
