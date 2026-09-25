import { FACTIONS } from 'questforge-shared/factions.js';
import { SCHOOL_COLORS } from './school-colors.js';

const ERROR_DISPLAY_MS = 2000;

export function createHud() {
  const playerFrame = createUnitFrame(document.getElementById('player-frame'));
  const targetFrame = createUnitFrame(document.getElementById('target-frame'));
  const castBar = document.getElementById('cast-bar');
  const castFill = castBar.querySelector('.cast-fill');
  const castName = castBar.querySelector('.cast-name');
  const errorMessage = document.getElementById('error-message');

  let activeCast = null;
  let errorHideTime = 0;

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

  function update({ player, target, targetRelationship, now }) {
    playerFrame.show(player, 'self');
    targetFrame.show(target, targetRelationship);

    castBar.hidden = !activeCast;
    if (activeCast) {
      const progress = Math.min((now - activeCast.startedAt) / activeCast.durationMs, 1);
      castFill.style.width = `${progress * 100}%`;
    }

    errorMessage.hidden = now >= errorHideTime;
  }

  return { startCast, stopCast, showError, update };
}

function createUnitFrame(element) {
  const nameElement = element.querySelector('.unit-name');
  const detailsElement = element.querySelector('.unit-details');
  const healthFill = element.querySelector('.health-fill');
  const healthText = element.querySelector('.health-text');
  const manaFill = element.querySelector('.mana-fill');
  const manaText = element.querySelector('.mana-text');

  function show(entity, relationship) {
    element.hidden = !entity;
    if (!entity) return;

    const mana = Math.floor(entity.mana);
    nameElement.textContent = entity.health === 0 ? `${entity.name} (dead)` : entity.name;
    nameElement.dataset.relationship = relationship;
    const factionName = entity.faction ? FACTIONS[entity.faction].name : 'No faction';
    detailsElement.textContent = `Level ${entity.level} · ${factionName}`;
    healthFill.style.width = `${(entity.health / entity.maxHealth) * 100}%`;
    healthText.textContent = `${entity.health} / ${entity.maxHealth}`;
    manaFill.style.width = `${(mana / entity.maxMana) * 100}%`;
    manaText.textContent = `${mana} / ${entity.maxMana}`;
  }

  return { show };
}
