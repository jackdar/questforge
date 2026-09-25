import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, splitMoney } from '../money.js';

test('copper splits into gold, silver, and copper', () => {
  assert.deepEqual(splitMoney(1_02_03), { gold: 1, silver: 2, copper: 3 });
});

test('money shows only the coins it has', () => {
  assert.equal(formatMoney(1_00_05), '1 Gold 5 Copper');
  assert.equal(formatMoney(12), '12 Copper');
  assert.equal(formatMoney(3_00), '3 Silver');
});

test('no money shows as zero copper', () => {
  assert.equal(formatMoney(0), '0 Copper');
});
