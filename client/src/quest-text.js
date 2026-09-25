import { CREATURES } from 'questforge-shared/creatures.js';
import { ITEMS } from 'questforge-shared/items.js';
import { NPCS } from 'questforge-shared/npcs.js';
import { QUESTS } from 'questforge-shared/quests.js';
import { getObjectiveProgress, getQuestStatus } from 'questforge-shared/quest-rules.js';

// One line for each objective, for example "Grey Wolf slain: 2/5". A talk quest has one line that names the NPC,
// and the line is met only when the quest is completed.
export function describeObjectives(questId, questLog, stacks) {
  const quest = QUESTS[questId];
  if (quest.objectives.length === 0) {
    const isMet = getQuestStatus(questId, questLog, stacks) === 'completed';
    return [{ text: `Speak to ${NPCS[quest.turnIn].name}`, isMet }];
  }

  return getObjectiveProgress(questId, questLog, stacks).map(({ objective, current, isMet }) => ({
    text: `${objectiveName(objective)}: ${current}/${objective.count}`,
    isMet,
  }));
}

// The messages that show the player new quest progress, for example "Grey Wolf slain: 3/5".
// A quest that the player just accepted shows no message, even when it is already done, such as a talk quest.
export function describeProgressChanges(before, after) {
  const messages = [];
  for (const [questId, entry] of Object.entries(after.questLog)) {
    if (entry.status !== 'active' || before.questLog[questId]?.status !== 'active') continue;

    const linesBefore = describeObjectives(questId, before.questLog, before.stacks);
    const linesAfter = describeObjectives(questId, after.questLog, after.stacks);
    const objectivesBefore = getObjectiveProgress(questId, before.questLog, before.stacks);
    getObjectiveProgress(questId, after.questLog, after.stacks).forEach(({ current }, index) => {
      if (current > objectivesBefore[index].current) messages.push(linesAfter[index].text);
    });

    const wasDone = linesBefore.every((line) => line.isMet);
    if (!wasDone && linesAfter.every((line) => line.isMet)) messages.push(`${QUESTS[questId].name} (Complete)`);
  }
  return messages;
}

function objectiveName(objective) {
  if (objective.type === 'kill') return `${CREATURES[objective.creatureKind].name} slain`;
  return ITEMS[objective.itemId].name;
}
