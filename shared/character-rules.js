import { FACTIONS } from './factions.js';

export const CHARACTER_NAME_MIN_LENGTH = 2;
export const CHARACTER_NAME_MAX_LENGTH = 12;
export const STARTING_LEVEL = 1;

const CHARACTER_NAME_PATTERN = /^[A-Za-z]+$/;

export function validateCharacterName(name) {
  if (
    typeof name !== 'string' ||
    name.length < CHARACTER_NAME_MIN_LENGTH ||
    name.length > CHARACTER_NAME_MAX_LENGTH
  ) {
    return `A character name must have ${CHARACTER_NAME_MIN_LENGTH} to ${CHARACTER_NAME_MAX_LENGTH} letters.`;
  }
  if (!CHARACTER_NAME_PATTERN.test(name)) return 'A character name can contain only the letters A to Z.';
  return null;
}

export function validateFaction(faction) {
  return typeof faction === 'string' && Object.hasOwn(FACTIONS, faction) ? null : 'Choose one of the listed factions.';
}

// As in WoW, a name has a capital first letter and small letters after it, so "tHRALL" becomes "Thrall".
export function formatCharacterName(name) {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
