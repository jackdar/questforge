import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compassBearing } from '../src/compass.js';

test('a character that faces -z faces north', () => {
  assert.equal(compassBearing(Math.PI), 0);
});

test('a character that faces +x faces east', () => {
  assert.equal(compassBearing(Math.PI / 2), Math.PI / 2);
});

test('a character that faces +z faces south', () => {
  assert.equal(compassBearing(0), Math.PI);
});

test('the bearing stays between 0 and a full turn for any rotation', () => {
  for (const rotation of [-7, -Math.PI, 3 * Math.PI, 10]) {
    const bearing = compassBearing(rotation);
    assert.ok(bearing >= 0 && bearing < 2 * Math.PI, `rotation ${rotation} gave bearing ${bearing}`);
  }
});
