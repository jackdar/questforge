import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LENGTH_MS, formatClock, timeOfDay } from '../world-time.js';

test('the time of day repeats every day length', () => {
  assert.equal(timeOfDay(DAY_LENGTH_MS / 4), 0.25);
  assert.equal(timeOfDay(3 * DAY_LENGTH_MS + DAY_LENGTH_MS / 2), 0.5);
});

test('a real minute is a game hour', () => {
  assert.equal(formatClock(timeOfDay(60 * 1000)), '01:00');
});

test('the clock shows hours and minutes with two digits each', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(0.5), '12:00');
  assert.equal(formatClock(0.75 + 5 / (24 * 60)), '18:05');
});
