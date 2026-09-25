import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../items.js';
import { addToBags, moveStack, removeFromBags, BAG_SLOT_COUNT } from '../inventory-rules.js';

const FANG_STACK_SIZE = ITEMS.wolfFang.maxStack;
const fullBags = Array.from({ length: BAG_SLOT_COUNT }, (_, slot) => ({
  slot,
  itemId: 'wornLeatherBoots',
  quantity: 1,
}));

test('an item goes into the lowest empty slot of empty bags', () => {
  assert.deepEqual(addToBags([], { itemId: 'wolfPelt', quantity: 1 }), {
    stacks: [{ slot: 0, itemId: 'wolfPelt', quantity: 1 }],
  });
});

test('an item fills a stack of the same item before it takes an empty slot', () => {
  const stacks = [{ slot: 3, itemId: 'wolfFang', quantity: 2 }];

  assert.deepEqual(addToBags(stacks, { itemId: 'wolfFang', quantity: 2 }), {
    stacks: [{ slot: 3, itemId: 'wolfFang', quantity: 4 }],
  });
});

test('an item that overfills a stack puts the rest in the lowest empty slot', () => {
  const stacks = [
    { slot: 0, itemId: 'wolfPelt', quantity: 1 },
    { slot: 1, itemId: 'wolfFang', quantity: FANG_STACK_SIZE - 1 },
  ];

  assert.deepEqual(addToBags(stacks, { itemId: 'wolfFang', quantity: 2 }), {
    stacks: [
      { slot: 0, itemId: 'wolfPelt', quantity: 1 },
      { slot: 1, itemId: 'wolfFang', quantity: FANG_STACK_SIZE },
      { slot: 2, itemId: 'wolfFang', quantity: 1 },
    ],
  });
});

test('an item that does not fit into full bags is refused', () => {
  assert.deepEqual(addToBags(fullBags, { itemId: 'wolfPelt', quantity: 1 }), { error: 'Your bags are full.' });
});

test('an item still fits into full bags when a stack of the same item has room', () => {
  const bags = [...fullBags.slice(1), { slot: 0, itemId: 'wolfFang', quantity: 1 }];

  const { stacks } = addToBags(bags, { itemId: 'wolfFang', quantity: 1 });

  assert.deepEqual(stacks[0], { slot: 0, itemId: 'wolfFang', quantity: 2 });
});

test('adding an item does not change the stacks it gets', () => {
  const stacks = [{ slot: 0, itemId: 'wolfFang', quantity: 1 }];

  addToBags(stacks, { itemId: 'wolfFang', quantity: 1 });

  assert.deepEqual(stacks, [{ slot: 0, itemId: 'wolfFang', quantity: 1 }]);
});

test('a stack moved onto an empty slot moves there', () => {
  const stacks = [{ slot: 0, itemId: 'wolfPelt', quantity: 1 }];

  assert.deepEqual(moveStack(stacks, 0, 5), { stacks: [{ slot: 5, itemId: 'wolfPelt', quantity: 1 }] });
});

test('a stack moved onto another item swaps places with it', () => {
  const stacks = [
    { slot: 0, itemId: 'wolfPelt', quantity: 1 },
    { slot: 1, itemId: 'wolfMeat', quantity: 1 },
  ];

  assert.deepEqual(moveStack(stacks, 0, 1), {
    stacks: [
      { slot: 0, itemId: 'wolfMeat', quantity: 1 },
      { slot: 1, itemId: 'wolfPelt', quantity: 1 },
    ],
  });
});

test('a stack moved onto the same item merges into it', () => {
  const stacks = [
    { slot: 0, itemId: 'wolfFang', quantity: 3 },
    { slot: 1, itemId: 'wolfFang', quantity: 4 },
  ];

  assert.deepEqual(moveStack(stacks, 0, 1), { stacks: [{ slot: 1, itemId: 'wolfFang', quantity: 7 }] });
});

test('a merge that overfills the target stack leaves the rest in the first slot', () => {
  const stacks = [
    { slot: 0, itemId: 'wolfFang', quantity: 5 },
    { slot: 1, itemId: 'wolfFang', quantity: FANG_STACK_SIZE - 2 },
  ];

  assert.deepEqual(moveStack(stacks, 0, 1), {
    stacks: [
      { slot: 0, itemId: 'wolfFang', quantity: 3 },
      { slot: 1, itemId: 'wolfFang', quantity: FANG_STACK_SIZE },
    ],
  });
});

test('a move from an empty slot is refused', () => {
  assert.deepEqual(moveStack([], 0, 1), { error: 'That bag slot is empty.' });
});

test('a move to a slot outside the bags is refused', () => {
  const stacks = [{ slot: 0, itemId: 'wolfPelt', quantity: 1 }];

  assert.deepEqual(moveStack(stacks, 0, BAG_SLOT_COUNT), { error: 'That bag slot does not exist.' });
  assert.deepEqual(moveStack(stacks, 0, 1.5), { error: 'That bag slot does not exist.' });
});

test('removed items leave the stacks in the highest slots first', () => {
  const stacks = [
    { slot: 0, itemId: 'wolfPelt', quantity: 2 },
    { slot: 3, itemId: 'wolfMeat', quantity: 1 },
    { slot: 5, itemId: 'wolfPelt', quantity: 2 },
  ];

  assert.deepEqual(removeFromBags(stacks, { itemId: 'wolfPelt', quantity: 3 }), {
    stacks: [
      { slot: 0, itemId: 'wolfPelt', quantity: 1 },
      { slot: 3, itemId: 'wolfMeat', quantity: 1 },
    ],
  });
});

test('removing more items than the bags hold is refused', () => {
  const stacks = [{ slot: 0, itemId: 'wolfPelt', quantity: 2 }];

  assert.deepEqual(removeFromBags(stacks, { itemId: 'wolfPelt', quantity: 3 }), {
    error: 'You do not have enough Wolf Pelt.',
  });
});
