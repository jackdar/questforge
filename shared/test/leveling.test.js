import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addXp,
  killXp,
  levelDamageScale,
  levelDifficulty,
  playerMaxHealth,
  playerSpellPower,
  xpToNextLevel,
  zeroDifference,
  PLATEAU_LEVEL,
} from '../leveling.js';

test('level 1 needs 100 xp, so the first quest gives a level at once', () => {
  assert.equal(xpToNextLevel(1), 100);
});

test('each level up to the plateau needs more xp than the level before', () => {
  for (let level = 2; level <= PLATEAU_LEVEL; level++) {
    assert.ok(xpToNextLevel(level) > xpToNextLevel(level - 1), `level ${level}`);
  }
});

test('every level from the plateau on needs the same xp as the plateau level', () => {
  for (let level = PLATEAU_LEVEL; level <= PLATEAU_LEVEL + 30; level++) {
    assert.equal(xpToNextLevel(level), xpToNextLevel(PLATEAU_LEVEL), `level ${level}`);
  }
});

test('xp below the next level adds to the progress in the current level', () => {
  assert.deepEqual(addXp({ level: 3, xp: 100 }, 50), { level: 3, xp: 150 });
});

test('xp that reaches the next level gives the level and keeps the rest', () => {
  assert.deepEqual(addXp({ level: 1, xp: 60 }, 150), { level: 2, xp: 110 });
});

test('a large xp gain can give more than one level', () => {
  const gain = xpToNextLevel(1) + xpToNextLevel(2) + 5;

  assert.deepEqual(addXp({ level: 1, xp: 0 }, gain), { level: 3, xp: 5 });
});

test('a grey wolf gives a level 1 player 20 xp, so five wolves give level 2', () => {
  assert.equal(killXp({ maxHealth: 60, level: 1 }, 1), 20);
});

test('a creature with more health gives more xp', () => {
  assert.ok(killXp({ maxHealth: 200, level: 1 }, 1) > killXp({ maxHealth: 60, level: 1 }, 1));
});

test('a creature of a higher level gives more xp', () => {
  assert.ok(killXp({ maxHealth: 60, level: 5 }, 5) > killXp({ maxHealth: 60, level: 1 }, 1));
});

test('a creature above the player gives 5% more xp for each level, up to 4 levels', () => {
  const creature = { maxHealth: 100, level: 10 };
  const sameLevelXp = killXp(creature, 10);

  assert.equal(killXp(creature, 8), Math.round(sameLevelXp * 1.1));
  assert.equal(killXp(creature, 4), Math.round(sameLevelXp * 1.2));
});

test('a creature below the player gives less xp as the gap grows', () => {
  const creature = { maxHealth: 60, level: 1 };

  assert.equal(killXp(creature, 2), 16);
  assert.equal(killXp(creature, 3), 12);
});

test('a creature at the zero difference below the player or further gives no xp', () => {
  const creature = { maxHealth: 60, level: 1 };

  assert.equal(killXp(creature, 1 + zeroDifference(1)), 0);
  assert.equal(killXp(creature, 20), 0);
});

test('the zero difference grows from 5 levels to 12 levels as the player levels', () => {
  assert.deepEqual(
    [1, 7, 8, 10, 12, 16, 20, 30, 40, 60].map(zeroDifference),
    [5, 5, 6, 7, 8, 9, 10, 11, 12, 12],
  );
});

test('a unit level shows red, orange, yellow, green, or grey by its gap to the player level', () => {
  const playerLevel = 10;

  assert.deepEqual(
    [15, 13, 12, 8, 7, 4, 3].map((unitLevel) => levelDifficulty(unitLevel, playerLevel)),
    ['red', 'orange', 'yellow', 'yellow', 'green', 'green', 'grey'],
  );
});

// Units start at level 1, so a player below level 6 cannot meet a grey unit.
test('a unit that gives no xp shows grey', () => {
  for (const playerLevel of [6, 10, 25, 50]) {
    const greyLevel = playerLevel - zeroDifference(playerLevel);

    assert.equal(levelDifficulty(greyLevel, playerLevel), 'grey', `player level ${playerLevel}`);
    assert.equal(killXp({ maxHealth: 60, level: greyLevel }, playerLevel), 0, `player level ${playerLevel}`);
  }
});

test('an attacker at the level of its target deals full damage', () => {
  assert.equal(levelDamageScale(4, 4), 1);
});

test('each level of gap changes damage by a tenth', () => {
  assert.ok(Math.abs(levelDamageScale(5, 3) - 1.2) < 1e-9);
  assert.ok(Math.abs(levelDamageScale(3, 5) - 0.8) < 1e-9);
});

test('a level gap changes damage by half at most', () => {
  assert.equal(levelDamageScale(20, 1), 1.5);
  assert.equal(levelDamageScale(1, 20), 0.5);
});

test('a player has 100 health at level 1 and 10 more for each level after', () => {
  assert.equal(playerMaxHealth(1), 100);
  assert.equal(playerMaxHealth(6), 150);
});

test('a player spell does 5% more for each level after level 1', () => {
  assert.equal(playerSpellPower(1), 1);
  assert.ok(Math.abs(playerSpellPower(6) - 1.25) < 1e-9);
});
