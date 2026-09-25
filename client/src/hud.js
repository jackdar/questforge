import { FACTIONS } from 'questforge-shared/factions.js';
import { SCHOOL_COLORS } from './school-colors.js';
import { showLevel } from './level-label.js';

const ERROR_DISPLAY_MS = 2000;
const QUEST_MESSAGE_DISPLAY_MS = 3000;

export function createHud() {
  const playerFrame = createUnitFrame(document.getElementById('player-frame'));
  const targetFrame = createUnitFrame(document.getElementById('target-frame'));
  const castBar = document.getElementById('cast-bar');
  const castFill = castBar.querySelector('.cast-fill');
  const castName = castBar.querySelector('.cast-name');
  const errorMessage = document.getElementById('error-message');
  const questMessage = document.getElementById('quest-message');

  let activeCast = null;
  let errorHideTime = 0;
  let questMessageHideTime = 0;

  function startCast(spell, durationMs, now) {
    activeCast = { spell, durationMs, startedAt: now };
    castName.textContent = spell.name;
    castFill.style.background = SCHOOL_COLORS[spell.school];
  }

  function stopCast() {
    activeCast = null;
  }

  function showError(message, now) {
    errorMessage.textContent = message;
    errorHideTime = now + ERROR_DISPLAY_MS;
  }

  // Several messages at once, such as the last kill and the quest completion, show one line each.
  function showQuestMessages(messages, now) {
    if (messages.length === 0) return;
    questMessage.replaceChildren(
      ...messages.map((message) => {
        const line = document.createElement('div');
        line.textContent = message;
        return line;
      }),
    );
    questMessageHideTime = now + QUEST_MESSAGE_DISPLAY_MS;
  }

  function update({ player, target, targetRelationship, now }) {
    playerFrame.show(player, 'self', null);
    const showsDifficulty = targetRelationship === 'hostile' || targetRelationship === 'neutral';
    targetFrame.show(target, targetRelationship, showsDifficulty ? player : null);

    castBar.hidden = !activeCast;
    if (activeCast) {
      const progress = Math.min((now - activeCast.startedAt) / activeCast.durationMs, 1);
      castFill.style.width = `${progress * 100}%`;
    }

    errorMessage.hidden = now >= errorHideTime;
    questMessage.hidden = now >= questMessageHideTime;
  }

  return { startCast, stopCast, showError, update, showQuestMessages };
}

function createUnitFrame(element) {
  const nameElement = element.querySelector('.unit-name');
  const detailsElement = element.querySelector('.unit-details');
  const levelElement = document.createElement('span');
  const factionText = document.createTextNode('');
  detailsElement.replaceChildren('Level ', levelElement, factionText);
  const healthFill = element.querySelector('.health-fill');
  const healthText = element.querySelector('.health-text');
  const manaBar = element.querySelector('.mana-bar');
  const manaFill = element.querySelector('.mana-fill');
  const manaText = element.querySelector('.mana-text');

  // The viewer is the local player when the unit is hostile, so that its level shows a difficulty colour.
  function show(entity, relationship, viewer) {
    element.hidden = !entity;
    if (!entity) return;

    const mana = Math.floor(entity.mana);
    nameElement.textContent = entity.health === 0 ? `${entity.name} (dead)` : entity.name;
    nameElement.dataset.relationship = relationship;
    const factionName = entity.faction ? FACTIONS[entity.faction].name : 'No faction';
    showLevel(levelElement, entity.level, viewer);
    factionText.data = ` · ${factionName}`;
    healthFill.style.width = `${(entity.health / entity.maxHealth) * 100}%`;
    healthText.textContent = `${entity.health} / ${entity.maxHealth}`;
    // A beast such as a wolf has no mana.
    manaBar.hidden = entity.maxMana === 0;
    manaFill.style.width = `${(mana / entity.maxMana) * 100}%`;
    manaText.textContent = `${mana} / ${entity.maxMana}`;
  }

  return { show };
}
