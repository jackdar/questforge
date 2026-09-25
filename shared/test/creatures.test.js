import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES } from '../creatures.js';
import { LOOT_TABLES, MONEY_TABLES } from '../loot-tables.js';
import { SPELLS } from '../spells.js';

const creatures = Object.values(CREATURES);

test('every creature kind matches its key', () => {
  for (const [key, creature] of Object.entries(CREATURES)) assert.equal(creature.kind, key);
});

test('every creature attacks with a creature-only automatic attack', () => {
  for (const creature of creatures) {
    const spell = SPELLS[creature.attackSpellId];
    assert.ok(spell?.isAutoAttack && spell.isCreatureOnly, creature.kind);
  }
});

test('every creature has a loot table and a money table', () => {
  for (const creature of creatures) {
    assert.ok(LOOT_TABLES[creature.lootTableId], creature.kind);
    assert.ok(MONEY_TABLES[creature.lootTableId], creature.kind);
  }
});

test('every creature has a level, health, a respawn delay, a wander radius, and an aggro radius', () => {
  for (const creature of creatures) {
    assert.ok(Number.isInteger(creature.level) && creature.level >= 1, creature.kind);
    assert.ok(creature.maxHealth > 0 && creature.respawnDelayMs > 0 && creature.wanderRadius >= 0, creature.kind);
    assert.ok(creature.aggroRadius > 0, creature.kind);
  }
});

test('every boss ability is a creature-only spell that is not an automatic attack', () => {
  for (const creature of creatures) {
    for (const spellId of creature.abilities ?? []) {
      const spell = SPELLS[spellId];
      assert.ok(spell?.isCreatureOnly && !spell.isAutoAttack, `${creature.kind} ${spellId}`);
    }
  }
});

test('every summon calls a creature that exists, at a health fraction below full', () => {
  for (const creature of creatures.filter((candidate) => candidate.summon)) {
    const { kind, count, atHealthFraction } = creature.summon;
    assert.ok(CREATURES[kind], creature.kind);
    assert.ok(Number.isInteger(count) && count >= 1, creature.kind);
    assert.ok(atHealthFraction > 0 && atHealthFraction < 1, creature.kind);
  }
});

test('every spell with damage over time deals a whole amount a whole number of times', () => {
  for (const spell of Object.values(SPELLS).filter((candidate) => candidate.damageOverTime)) {
    const { amount, intervalMs, ticks } = spell.damageOverTime;
    assert.ok(amount > 0 && intervalMs > 0 && Number.isInteger(ticks) && ticks >= 1, spell.id);
  }
});
