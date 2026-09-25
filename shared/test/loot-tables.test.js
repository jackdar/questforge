import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_QUALITIES } from '../items.js';
import { LOOT_TABLES, MONEY_TABLES } from '../loot-tables.js';
import { COIN_VALUES } from '../money.js';

const allEntries = Object.values(LOOT_TABLES).flat();

test('every item has a known quality and a stack size of at least one', () => {
  for (const item of Object.values(ITEMS)) {
    assert.ok(ITEM_QUALITIES.includes(item.quality), item.id);
    assert.ok(Number.isInteger(item.maxStack) && item.maxStack >= 1, item.id);
  }
});

test('every loot entry names an item that exists', () => {
  for (const entry of allEntries) assert.ok(ITEMS[entry.itemId], entry.itemId);
});

test('every drop chance is between 0 and 1', () => {
  for (const entry of allEntries) assert.ok(entry.dropChance >= 0 && entry.dropChance <= 1, entry.itemId);
});

test('every loot entry drops at least one item and no more than a stack', () => {
  for (const entry of allEntries) {
    assert.ok(entry.minQuantity >= 1, entry.itemId);
    assert.ok(entry.maxQuantity >= entry.minQuantity, entry.itemId);
    assert.ok(entry.maxQuantity <= ITEMS[entry.itemId].maxStack, entry.itemId);
  }
});


test('every money entry names a coin, a drop chance from 0 to 1, and an amount range of at least one', () => {
  for (const entry of Object.values(MONEY_TABLES).flat()) {
    assert.ok(COIN_VALUES[entry.coin], entry.coin);
    assert.ok(entry.dropChance >= 0 && entry.dropChance <= 1, entry.coin);
    assert.ok(entry.minAmount >= 1 && entry.maxAmount >= entry.minAmount, entry.coin);
  }
});

test('every loot table has a money table', () => {
  for (const lootTableId of Object.keys(LOOT_TABLES)) assert.ok(MONEY_TABLES[lootTableId], lootTableId);
});
