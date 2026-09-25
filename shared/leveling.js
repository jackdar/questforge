// Early levels need little XP, and each level needs more than the one before, up to level 20.
// From level 20 on, every level needs the same XP as level 20. There is no highest level.
export const PLATEAU_LEVEL = 20;

export function xpToNextLevel(level) {
  const curveLevel = Math.min(level, PLATEAU_LEVEL);
  return Math.round((100 * curveLevel ** 1.5) / 10) * 10;
}

// The xp of a character is its progress into its current level. A large gain can give more than one level.
export function addXp({ level, xp }, gainedXp) {
  let newLevel = level;
  let newXp = xp + gainedXp;
  while (newXp >= xpToNextLevel(newLevel)) {
    newXp -= xpToNextLevel(newLevel);
    newLevel += 1;
  }
  return { level: newLevel, xp: newXp };
}

export const HIGHER_LEVEL_BONUS_PER_LEVEL = 0.05;
export const MAX_BONUS_LEVELS = 4;

// As in WoW, a creature this many levels below the player gives no xp. The gap grows as the player levels.
const ZERO_DIFFERENCE_BY_MIN_LEVEL = [
  { minLevel: 40, levels: 12 },
  { minLevel: 30, levels: 11 },
  { minLevel: 20, levels: 10 },
  { minLevel: 16, levels: 9 },
  { minLevel: 12, levels: 8 },
  { minLevel: 10, levels: 7 },
  { minLevel: 8, levels: 6 },
  { minLevel: 1, levels: 5 },
];

export function zeroDifference(playerLevel) {
  return ZERO_DIFFERENCE_BY_MIN_LEVEL.find(({ minLevel }) => playerLevel >= minLevel).levels;
}

// A creature gives xp for its toughness: more health and a higher level give more xp.
// The level gap to the player then scales it, as in WoW: a creature above the player gives up to 20% more, and a
// creature below the player gives less, down to none at the zero difference. Such a creature is "grey".
export function killXp({ maxHealth, level }, playerLevel) {
  const baseXp = maxHealth / 4 + 5 * level;
  const levelGap = level - playerLevel;
  const scale =
    levelGap >= 0
      ? 1 + HIGHER_LEVEL_BONUS_PER_LEVEL * Math.min(levelGap, MAX_BONUS_LEVELS)
      : Math.max(1 + levelGap / zeroDifference(playerLevel), 0);
  return Math.round(baseXp * scale);
}

// As in WoW, the colour of a level shows how hard the unit is for the player:
// grey gives no xp, green is well below, yellow is close, orange is above, and red is far above.
export function levelDifficulty(unitLevel, playerLevel) {
  const levelGap = unitLevel - playerLevel;
  if (levelGap >= 5) return 'red';
  if (levelGap >= 3) return 'orange';
  if (levelGap >= -2) return 'yellow';
  if (levelGap > -zeroDifference(playerLevel)) return 'green';
  return 'grey';
}

// As in WoW, a level gap changes melee and spell damage: each level of the attacker above the target adds 10%, and
// each level below takes 10% away, up to half the damage either way. So levelling up makes hard enemies easier.
export const DAMAGE_CHANGE_PER_LEVEL = 0.1;
export const MAX_DAMAGE_CHANGE = 0.5;

export function levelDamageScale(attackerLevel, targetLevel) {
  const change = (attackerLevel - targetLevel) * DAMAGE_CHANGE_PER_LEVEL;
  return 1 + Math.min(Math.max(change, -MAX_DAMAGE_CHANGE), MAX_DAMAGE_CHANGE);
}

// A player grows stronger with each level: more health, and more damage and healing from every spell.
export const PLAYER_BASE_HEALTH = 100;
export const HEALTH_PER_LEVEL = 10;
export const SPELL_POWER_PER_LEVEL = 0.05;

export function playerMaxHealth(level) {
  return PLAYER_BASE_HEALTH + HEALTH_PER_LEVEL * (level - 1);
}

export function playerSpellPower(level) {
  return 1 + SPELL_POWER_PER_LEVEL * (level - 1);
}
