import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS } from '../spells.js';
import { chooseSpellTarget, isInRange, isFacing } from '../spell-rules.js';

const alice = { id: 'alice', faction: 'dawnguard', x: 0, y: 0, z: 0, rotation: 0 };
const friend = { id: 'bob', faction: 'dawnguard', x: 0, y: 0, z: 5, rotation: 0 };
const enemy = { id: 'eve', faction: 'emberclaw', x: 0, y: 0, z: 5, rotation: 0 };

test('a damage spell targets a hostile target', () => {
  assert.equal(chooseSpellTarget(SPELLS.firebolt, alice, enemy), enemy);
});

test('a damage spell has no target when the requested target is friendly', () => {
  assert.equal(chooseSpellTarget(SPELLS.firebolt, alice, friend), null);
});

test('a damage spell has no target when the caster targets itself', () => {
  assert.equal(chooseSpellTarget(SPELLS.firebolt, alice, alice), null);
});

test('a heal targets a friendly target', () => {
  assert.equal(chooseSpellTarget(SPELLS.mend, alice, friend), friend);
});

test('a heal falls back to the caster when the target is hostile', () => {
  assert.equal(chooseSpellTarget(SPELLS.mend, alice, enemy), alice);
});

test('a heal falls back to the caster when there is no target', () => {
  assert.equal(chooseSpellTarget(SPELLS.mend, alice, null), alice);
});

test('a target at exactly the maximum range is in range', () => {
  assert.equal(isInRange(SPELLS.strike, alice, { ...enemy, z: SPELLS.strike.maxRange }), true);
});

test('a target past the maximum range is out of range', () => {
  assert.equal(isInRange(SPELLS.strike, alice, { ...enemy, z: SPELLS.strike.maxRange + 0.1 }), false);
});

test('a target above the caster counts its height in the range', () => {
  const targetOnLedge = { ...enemy, y: 4.5, z: 3 };

  assert.equal(isInRange(SPELLS.strike, alice, targetOnLedge), false);
  assert.equal(isInRange(SPELLS.strike, alice, { ...targetOnLedge, y: 0 }), true);
});

test('a caster with rotation 0 faces a target in the +z direction', () => {
  assert.equal(isFacing(alice, { ...enemy, z: 5 }), true);
});

test('a caster does not face a target behind it', () => {
  assert.equal(isFacing(alice, { ...enemy, z: -5 }), false);
});

test('a caster turned half a circle faces a target behind its old facing', () => {
  assert.equal(isFacing({ ...alice, rotation: Math.PI }, { ...enemy, z: -5 }), true);
});
