import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToScreen } from '../src/draggable-window.js';

const windowSize = { width: 200, height: 100 };
const viewport = { viewportWidth: 1000, viewportHeight: 800 };

test('a window inside the screen keeps its position', () => {
  assert.deepEqual(clampToScreen({ left: 300, top: 400 }, windowSize, viewport), { left: 300, top: 400 });
});

test('a window dragged past the top left corner stops at the corner', () => {
  assert.deepEqual(clampToScreen({ left: -50, top: -20 }, windowSize, viewport), { left: 0, top: 0 });
});

test('a window dragged past the bottom right corner stays fully on the screen', () => {
  assert.deepEqual(clampToScreen({ left: 950, top: 790 }, windowSize, viewport), { left: 800, top: 700 });
});

test('a window larger than the screen stays at the top left corner', () => {
  assert.deepEqual(clampToScreen({ left: 50, top: 50 }, { width: 1200, height: 900 }, viewport), { left: 0, top: 0 });
});
