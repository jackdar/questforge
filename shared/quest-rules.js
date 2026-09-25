import { QUESTS } from './quests.js';
import { addToBags, removeFromBags } from './inventory-rules.js';

// A quest log maps a quest id to { status, progress }. The status is 'active' or 'completed'.
// The progress holds the kill count of each kill objective, by objective index.
// Collect objectives count from the bag stacks instead, because the player can drop or use the items.

export function getQuestStatus(questId, questLog, stacks) {
  const entry = questLog[questId];
  if (entry?.status === 'completed') return 'completed';
  // A talk quest has no objectives, but it is only done when the player speaks to the turn-in NPC.
  if (entry?.status === 'active') {
    const hasObjectives = QUESTS[questId].objectives.length > 0;
    const objectives = getObjectiveProgress(questId, questLog, stacks);
    const isDone = hasObjectives && objectives.every((objective) => objective.isMet);
    return isDone ? 'readyToTurnIn' : 'active';
  }
  const hasCompletedEarlierQuests = QUESTS[questId].requires.every((id) => questLog[id]?.status === 'completed');
  return hasCompletedEarlierQuests ? 'available' : 'unavailable';
}

export function getObjectiveProgress(questId, questLog, stacks) {
  const progress = questLog[questId]?.progress ?? [];
  return QUESTS[questId].objectives.map((objective, index) => {
    const counted = objective.type === 'kill' ? (progress[index] ?? 0) : countItem(stacks, objective.itemId);
    const current = Math.min(counted, objective.count);
    return { objective, current, isMet: current >= objective.count };
  });
}

// Returns the new progress of each active quest that the kill counts for, by quest id.
// A kill beyond the objective count does not count, so the saved progress stays at the count.
export function countKill(questLog, creatureKind) {
  const changedProgress = {};
  for (const [questId, entry] of Object.entries(questLog)) {
    if (entry.status !== 'active') continue;
    const progress = [...entry.progress];
    let didCount = false;
    QUESTS[questId].objectives.forEach((objective, index) => {
      const kills = progress[index] ?? 0;
      if (objective.type !== 'kill' || objective.creatureKind !== creatureKind || kills >= objective.count) return;
      progress[index] = kills + 1;
      didCount = true;
    });
    if (didCount) changedProgress[questId] = progress;
  }
  return changedProgress;
}

// A done quest can be turned in. A talk quest can be turned in while it is active, because speaking to the
// turn-in NPC is its only objective.
export function canTurnInQuest(questId, questLog, stacks) {
  const status = getQuestStatus(questId, questLog, stacks);
  const isTalkQuest = QUESTS[questId].objectives.length === 0;
  return status === 'readyToTurnIn' || (isTalkQuest && status === 'active');
}

// The turn-in takes the collected items first and then gives the reward items, so the freed space can hold them.
// Returns the new bag stacks, or an error when the quest is not done or the rewards do not fit.
export function applyQuestTurnIn(questId, questLog, stacks) {
  if (!canTurnInQuest(questId, questLog, stacks)) return { error: 'That quest is not complete.' };

  let newStacks = stacks;
  for (const objective of QUESTS[questId].objectives.filter((candidate) => candidate.type === 'collect')) {
    const result = removeFromBags(newStacks, { itemId: objective.itemId, quantity: objective.count });
    if (result.error) return result;
    newStacks = result.stacks;
  }
  for (const item of QUESTS[questId].rewards.items) {
    const result = addToBags(newStacks, item);
    if (result.error) return result;
    newStacks = result.stacks;
  }
  return { stacks: newStacks };
}

// The quests that an NPC shows in its dialog: the quests it offers, and the active quests that it takes back.
export function getNpcQuests(npcId, questLog, stacks) {
  return Object.values(QUESTS)
    .map((quest) => ({ questId: quest.id, status: getQuestStatus(quest.id, questLog, stacks) }))
    .filter(({ questId, status }) => {
      const quest = QUESTS[questId];
      if (status === 'available') return quest.giver === npcId;
      return (status === 'active' || status === 'readyToTurnIn') && quest.turnIn === npcId;
    });
}

// As in WoW: a yellow "?" for a quest to turn in, a yellow "!" for a new quest, and a grey "?" for a quest in progress.
export function getNpcMarker(npcId, questLog, stacks) {
  const statuses = getNpcQuests(npcId, questLog, stacks).map((quest) => quest.status);
  if (statuses.includes('readyToTurnIn')) return 'turnIn';
  if (statuses.includes('available')) return 'available';
  if (statuses.includes('active')) return 'inProgress';
  return null;
}

function countItem(stacks, itemId) {
  return stacks.filter((stack) => stack.itemId === itemId).reduce((total, stack) => total + stack.quantity, 0);
}
