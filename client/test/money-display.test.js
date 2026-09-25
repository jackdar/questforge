import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMoney } from '../src/money-display.js';

// The display only needs replaceChildren on the container and plain elements, so small stand-ins replace the page.
globalThis.document = { createElement: () => ({ className: '', textContent: '' }) };
const shownCoins = (container) => container.children.map(({ className, textContent }) => [className, textContent]);
const emptyContainer = {
  children: [],
  replaceChildren(...children) {
    this.children = children;
  },
};

test('money shows each coin that it has, with its colour', () => {
  const container = { ...emptyContainer };

  renderMoney(container, 1_00_05);

  assert.deepEqual(shownCoins(container), [
    ['coin coin-gold', '1g'],
    ['coin coin-copper', '5c'],
  ]);
});

test('no money shows as zero copper', () => {
  const container = { ...emptyContainer };

  renderMoney(container, 0);

  assert.deepEqual(shownCoins(container), [['coin coin-copper', '0c']]);
});
