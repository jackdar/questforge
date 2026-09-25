import { QUESTS } from 'questforge-shared/quests.js';
import { getQuestStatus } from 'questforge-shared/quest-rules.js';
import { describeObjectives } from './quest-text.js';

const ABANDON_CONFIRM_MS = 3000;

// The tracker lists the active quests with their progress. Abandon needs a second click, so a stray click is safe.
export function createQuestTracker({ onAbandon }) {
  const panel = document.getElementById('quest-tracker');
  const list = panel.querySelector('.quest-tracker-list');

  function render(questLog, stacks) {
    const activeQuestIds = Object.keys(questLog).filter((questId) => questLog[questId].status === 'active');
    panel.hidden = activeQuestIds.length === 0;
    list.replaceChildren(...activeQuestIds.map((questId) => createEntry(questId, questLog, stacks)));
  }

  function createEntry(questId, questLog, stacks) {
    const entry = document.createElement('div');
    entry.className = 'quest-tracker-entry';

    const title = document.createElement('div');
    title.className = 'quest-tracker-title';
    title.textContent = QUESTS[questId].name;
    if (getQuestStatus(questId, questLog, stacks) === 'readyToTurnIn') {
      const complete = document.createElement('span');
      complete.className = 'quest-complete';
      complete.textContent = ' (Complete)';
      title.append(complete);
    }
    title.append(createAbandonButton(questId));
    entry.append(title);

    for (const { text, isMet } of describeObjectives(questId, questLog, stacks)) {
      const line = document.createElement('div');
      line.className = isMet ? 'quest-objective met' : 'quest-objective';
      line.textContent = `- ${text}`;
      entry.append(line);
    }
    return entry;
  }

  function createAbandonButton(questId) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quest-abandon';
    button.textContent = 'Abandon';
    let confirmTimer = null;
    button.addEventListener('click', () => {
      if (confirmTimer === null) {
        button.textContent = 'Click again to abandon';
        confirmTimer = setTimeout(() => {
          button.textContent = 'Abandon';
          confirmTimer = null;
        }, ABANDON_CONFIRM_MS);
        return;
      }
      clearTimeout(confirmTimer);
      onAbandon(questId);
    });
    return button;
  }

  function clear() {
    render({}, []);
  }

  return { render, clear };
}
