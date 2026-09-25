import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../items.js';
import { NPCS } from '../npcs.js';
import { SHOPS } from '../shops.js';
import { BUYBACK_SIZE, addToBuyback, applyBuyback, applyPurchase, applySale } from '../shop-rules.js';
import { BAG_SLOT_COUNT } from '../inventory-rules.js';

const emptyBags = { stacks: [], copper: 1_00 };

test('every item has a whole sell price, and an item with a buy price sells for less than it costs', () => {
  for (const item of Object.values(ITEMS)) {
    assert.ok(Number.isInteger(item.sellPrice) && item.sellPrice >= 0, item.id);
    if (item.buyPrice !== undefined) assert.ok(item.sellPrice < item.buyPrice, item.id);
  }
});

test('every shop item exists and has a buy price', () => {
  for (const shop of Object.values(SHOPS)) {
    for (const itemId of shop.itemIds) assert.ok(Number.isInteger(ITEMS[itemId]?.buyPrice), `${shop.id} ${itemId}`);
  }
});

test('every NPC with a shop names a shop that exists', () => {
  for (const npc of Object.values(NPCS).filter((candidate) => candidate.shopId)) assert.ok(SHOPS[npc.shopId], npc.id);
});

test('a purchase puts one item into the bags and takes its price', () => {
  assert.deepEqual(applyPurchase(emptyBags, 'mossbeardGoods', 'linenCloth'), {
    stacks: [{ slot: 0, itemId: 'linenCloth', quantity: 1 }],
    copper: 1_00 - ITEMS.linenCloth.buyPrice,
  });
});

test('an item cannot be bought without enough money', () => {
  const poorBags = { stacks: [], copper: ITEMS.linenCloth.buyPrice - 1 };

  assert.deepEqual(applyPurchase(poorBags, 'mossbeardGoods', 'linenCloth'), {
    error: 'You do not have enough money.',
  });
});

test('an item that the shop does not sell cannot be bought there', () => {
  assert.deepEqual(applyPurchase(emptyBags, 'mossbeardGoods', 'wolfPelt'), {
    error: 'That item is not for sale here.',
  });
});

test('an item cannot be bought into full bags, and the money stays', () => {
  const fullBags = {
    stacks: Array.from({ length: BAG_SLOT_COUNT }, (_, slot) => ({ slot, itemId: 'wolfPelt', quantity: 20 })),
    copper: 1_00,
  };

  assert.deepEqual(applyPurchase(fullBags, 'mossbeardGoods', 'linenCloth'), { error: 'Your bags are full.' });
});

const bagsWithPelts = {
  stacks: [
    { slot: 0, itemId: 'wolfPelt', quantity: 3 },
    { slot: 2, itemId: 'wolfMeat', quantity: 1 },
  ],
  copper: 10,
};

test('a sale sells the whole stack for its sell price and returns the sale', () => {
  assert.deepEqual(applySale(bagsWithPelts, 0), {
    stacks: [{ slot: 2, itemId: 'wolfMeat', quantity: 1 }],
    copper: 10 + 3 * ITEMS.wolfPelt.sellPrice,
    sale: { itemId: 'wolfPelt', quantity: 3, price: 3 * ITEMS.wolfPelt.sellPrice },
  });
});

test('an empty bag slot cannot be sold', () => {
  assert.deepEqual(applySale(bagsWithPelts, 5), { error: 'That bag slot is empty.' });
});

test('a sale bought back returns the stack and costs what the trader paid', () => {
  const sale = { itemId: 'wolfPelt', quantity: 3, price: 45 };

  assert.deepEqual(applyBuyback({ stacks: [], copper: 50 }, sale), {
    stacks: [{ slot: 0, itemId: 'wolfPelt', quantity: 3 }],
    copper: 5,
  });
});

test('a sale cannot be bought back without enough money', () => {
  const sale = { itemId: 'wolfPelt', quantity: 3, price: 45 };

  assert.deepEqual(applyBuyback({ stacks: [], copper: 44 }, sale), { error: 'You do not have enough money.' });
});

test('the buyback list shows the newest sale first and keeps only the last sales', () => {
  let buyback = [];
  for (let sale = 1; sale <= BUYBACK_SIZE + 2; sale++) buyback = addToBuyback(buyback, { id: sale });

  assert.equal(buyback.length, BUYBACK_SIZE);
  assert.equal(buyback[0].id, BUYBACK_SIZE + 2);
  assert.equal(buyback.at(-1).id, 3);
});
