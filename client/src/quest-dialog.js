import { ITEMS } from 'questforge-shared/items.js';
import { NPCS } from 'questforge-shared/npcs.js';
import { QUESTS } from 'questforge-shared/quests.js';
import { canTurnInQuest, getNpcQuests, getQuestStatus } from 'questforge-shared/quest-rules.js';
import { makeDraggable } from './draggable-window.js';
import { describeObjectives } from './quest-text.js';

const STATUS_SYMBOLS = { available: '!', active: '?', readyToTurnIn: '?' };

// An NPC with one quest for the player opens that quest at once. An NPC with more quests lists them first.
export function createQuestDialog({ storage, onAccept, onTurnIn }) {
  const panel = document.getElementById('quest-dialog');
  const title = panel.querySelector('.quest-dialog-title');
  const body = panel.querySelector('.quest-dialog-body');
  const buttons = panel.querySelector('.quest-dialog-buttons');
  const dragging = makeDraggable(panel, panel.querySelector('.quest-dialog-header'), { storage, storageKey: 'quest' });
  let npcId = null;
  let questId = null;

  panel.querySelector('[data-action="close-quest"]').addEventListener('click', close);

  function openForNpc(newNpcId, questLog, stacks) {
    npcId = newNpcId;
    questId = null;
    render(questLog, stacks);
    panel.hidden = false;
    dragging.keepOnScreen();
  }

  // The quest log or the bags changed. A quest that the player can no longer see here goes back to the list.
  function refresh(questLog, stacks) {
    if (panel.hidden) return;
    const isQuestStillHere = getNpcQuests(npcId, questLog, stacks).some((quest) => quest.questId === questId);
    if (questId && !isQuestStillHere) questId = null;
    render(questLog, stacks);
  }

  function render(questLog, stacks) {
    const npcQuests = getNpcQuests(npcId, questLog, stacks);
    if (!questId && npcQuests.length === 1) questId = npcQuests[0].questId;
    if (questId) renderQuest(questLog, stacks);
    else renderQuestList(npcQuests, questLog, stacks);
  }

  function renderQuestList(npcQuests, questLog, stacks) {
    title.textContent = NPCS[npcId].name;
    buttons.replaceChildren(createButton('Goodbye', close));
    if (npcQuests.length === 0) {
      body.replaceChildren(createParagraph('I have nothing for you right now.'));
      return;
    }

    body.replaceChildren(
      ...npcQuests.map(({ questId: listedQuestId, status }) => {
        const button = createButton(`${STATUS_SYMBOLS[status]} ${QUESTS[listedQuestId].name}`, () => {
          questId = listedQuestId;
          render(questLog, stacks);
        });
        button.className = 'quest-list-item';
        button.dataset.status = status;
        return button;
      }),
    );
  }

  function renderQuest(questLog, stacks) {
    const quest = QUESTS[questId];
    const status = getQuestStatus(questId, questLog, stacks);
    title.textContent = quest.name;

    const level = createParagraph(`Recommended level ${quest.recommendedLevel}`);
    level.className = 'quest-level';
    const objectives = describeObjectives(questId, questLog, stacks).map(({ text: line }) => createParagraph(line));
    const rewards = [createHeading('Rewards'), ...describeRewards(quest.rewards)];

    if (status === 'available') {
      const offer = createParagraph(quest.text.offer);
      body.replaceChildren(level, offer, createHeading('Objectives'), ...objectives, ...rewards);
      buttons.replaceChildren(
        createButton('Accept', () => onAccept(questId)),
        createButton('Decline', close),
      );
    } else if (canTurnInQuest(questId, questLog, stacks) && quest.turnIn === npcId) {
      body.replaceChildren(createParagraph(quest.text.completion), ...rewards);
      buttons.replaceChildren(createButton('Complete Quest', () => onTurnIn(questId)));
    } else {
      body.replaceChildren(level, createParagraph(quest.text.progress), createHeading('Objectives'), ...objectives);
      buttons.replaceChildren(createButton('Close', close));
    }
  }

  function close() {
    npcId = null;
    questId = null;
    panel.hidden = true;
  }

  return { openForNpc, refresh, close, isOpen: () => !panel.hidden, getNpcId: () => npcId };
}

function describeRewards({ xp, items }) {
  const lines = [createParagraph(`${xp} experience`)];
  for (const { itemId, quantity } of items) {
    const line = document.createElement('p');
    const name = document.createElement('span');
    name.className = 'item-name';
    name.dataset.quality = ITEMS[itemId].quality;
    name.textContent = ITEMS[itemId].name;
    line.append(name, quantity > 1 ? ` x${quantity}` : '');
    lines.push(line);
  }
  return lines;
}

function createParagraph(text) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  return paragraph;
}

function createHeading(text) {
  const heading = document.createElement('h3');
  heading.textContent = text;
  return heading;
}

function createButton(text, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', onClick);
  return button;
}
