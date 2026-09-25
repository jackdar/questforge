import { xpToNextLevel } from 'questforge-shared/leveling.js';

export function createXpBar() {
  const bar = document.getElementById('xp-bar');
  const fill = bar.querySelector('.xp-fill');
  const text = bar.querySelector('.xp-text');

  function update({ level, xp }) {
    const needed = xpToNextLevel(level);
    fill.style.width = `${(xp / needed) * 100}%`;
    text.textContent = `Level ${level} · ${xp} / ${needed} XP`;
    bar.hidden = false;
  }

  function hide() {
    bar.hidden = true;
  }

  return { update, hide };
}
