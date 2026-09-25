import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showLevel } from '../src/level-label.js';

// The label only needs the text and the data attributes of an element, so a plain object stands in for it.
const emptyLabel = { textContent: '', dataset: {} };

test('a hostile unit level shows its difficulty for the viewer', () => {
  const label = { ...emptyLabel, dataset: {} };

  showLevel(label, 15, { level: 10 });

  assert.equal(label.textContent, '15');
  assert.equal(label.dataset.difficulty, 'red');
});

test('a unit level without a viewer shows no difficulty colour', () => {
  const label = { ...emptyLabel, dataset: {} };

  showLevel(label, 15, null);

  assert.equal(label.dataset.difficulty, 'none');
});
