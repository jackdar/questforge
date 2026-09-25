import { levelDifficulty } from 'questforge-shared/leveling.js';

// Only a hostile unit gets a difficulty colour, as in WoW. The viewer is null for any other unit.
// The labels update every frame, so the element changes only when its text or colour is different.
export function showLevel(element, level, viewer) {
  const text = String(level);
  if (element.textContent !== text) element.textContent = text;
  const difficulty = viewer ? levelDifficulty(level, viewer.level) : 'none';
  if (element.dataset.difficulty !== difficulty) element.dataset.difficulty = difficulty;
}
