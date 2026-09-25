import { SPELLS } from 'questforge-shared/spells.js';
import { chooseSpellTarget, isInRange } from 'questforge-shared/spell-rules.js';
import { isTypingInFormField } from './keyboard.js';

const ACTION_BAR_SLOTS = [
  { keyCode: 'Digit1', label: '1', spellId: 'autoAttack' },
  { keyCode: 'Digit2', label: '2', spellId: 'strike' },
  { keyCode: 'Digit3', label: '3', spellId: 'firebolt' },
  { keyCode: 'Digit4', label: '4', spellId: 'iceLance' },
  { keyCode: 'Digit5', label: '5', spellId: 'mend' },
];

export function createActionBar(onCast) {
  const container = document.getElementById('action-bar');
  const cooldownReadyTimes = new Map();
  const buttons = ACTION_BAR_SLOTS.map((slot) => createActionButton(container, slot, onCast));
  let isAutoAttacking = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat || isTypingInFormField(event)) return;
    const slot = ACTION_BAR_SLOTS.find((candidate) => candidate.keyCode === event.code);
    if (slot) onCast(slot.spellId);
  });

  function startCooldown(spellId, now) {
    const { cooldownMs } = SPELLS[spellId];
    if (cooldownMs > 0) cooldownReadyTimes.set(spellId, now + cooldownMs);
  }

  function setAutoAttacking(value) {
    isAutoAttacking = value;
  }

  function update(now, caster, target) {
    for (const { spell, button, cooldownOverlay } of buttons) {
      const remainingMs = Math.max(0, (cooldownReadyTimes.get(spell.id) ?? 0) - now);
      const remainingFraction = spell.cooldownMs > 0 ? remainingMs / spell.cooldownMs : 0;
      cooldownOverlay.style.height = `${remainingFraction * 100}%`;

      button.classList.toggle('not-enough-mana', Boolean(caster) && caster.mana < spell.manaCost);
      button.classList.toggle('cannot-reach-target', Boolean(caster) && cannotReachTarget(spell, caster, target));
      button.classList.toggle('active', Boolean(spell.isAutoAttack) && isAutoAttacking);
    }
  }

  return { startCooldown, setAutoAttacking, update };
}

// As in WoW, a button turns red only when there is a target that the spell cannot use or cannot reach.
function cannotReachTarget(spell, caster, target) {
  if (!target) return false;
  const spellTarget = chooseSpellTarget(spell, caster, target);
  return !spellTarget || !isInRange(spell, caster, spellTarget);
}

function createActionButton(container, slot, onCast) {
  const spell = SPELLS[slot.spellId];

  const button = document.createElement('button');
  button.className = 'action-button';
  button.tabIndex = -1;
  button.title = describeSpell(spell);

  const keyLabel = document.createElement('span');
  keyLabel.className = 'action-key';
  keyLabel.textContent = slot.label;

  const nameLabel = document.createElement('span');
  nameLabel.className = 'action-name';
  nameLabel.textContent = spell.name;

  const cooldownOverlay = document.createElement('div');
  cooldownOverlay.className = 'cooldown-overlay';

  button.append(keyLabel, nameLabel, cooldownOverlay);
  // Keep focus on the page, so that the Space key does not press the last clicked button.
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => onCast(slot.spellId));
  container.append(button);

  return { spell, button, cooldownOverlay };
}

function describeSpell(spell) {
  const castTime = spell.castTimeMs > 0 ? `${spell.castTimeMs / 1000} s cast` : 'Instant';
  const cooldown = spell.cooldownMs > 0 ? ` · ${spell.cooldownMs / 1000} s cooldown` : '';
  const mana = spell.manaCost > 0 ? `${spell.manaCost} mana · ` : '';
  return `${spell.name} (${spell.school})\n${mana}${spell.maxRange} yd range · ${castTime}${cooldown}\n${spell.description}`;
}
