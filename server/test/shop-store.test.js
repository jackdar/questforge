import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ITEMS } from 'questforge-shared/items.js';
import { runMigrations } from '../src/database.js';
import { createAccountStore } from '../src/account-store.js';
import { createCharacterStore } from '../src/character-store.js';
import { createInventoryStore } from '../src/inventory-store.js';
import { createShopStore } from '../src/shop-store.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));
const newCharacter = { name: 'Jaina', faction: 'dawnguard', level: 1 };

describe('shop store', databaseTestOptions, () => {
  let testSchema;
  let characterStore;
  let shopStore;
  let characterId;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    characterStore = createCharacterStore(testSchema.pool);
    const { character } = await characterStore.createCharacter(account.id, newCharacter);
    characterId = character.id;
    shopStore = createShopStore(testSchema.pool);
  });

  afterEach(async () => {
    await testSchema.drop();
  });

  test('a purchase saves the item in the bags and the money that is left', async () => {
    await characterStore.addCopper(characterId, 1_00);

    const result = await shopStore.buyItem(characterId, 'mossbeardGoods', 'linenCloth');

    const copperLeft = 1_00 - ITEMS.linenCloth.buyPrice;
    assert.deepEqual(result, { stacks: [{ slot: 0, itemId: 'linenCloth', quantity: 1 }], copper: copperLeft });
    assert.equal(await characterStore.findCopper(characterId), copperLeft);
    assert.deepEqual(await createInventoryStore(testSchema.pool).listStacks(characterId), result.stacks);
  });

  test('a refused purchase saves nothing', async () => {
    const result = await shopStore.buyItem(characterId, 'mossbeardGoods', 'linenCloth');

    assert.deepEqual(result, { error: 'You do not have enough money.' });
    assert.equal(await characterStore.findCopper(characterId), 0);
    assert.deepEqual(await createInventoryStore(testSchema.pool).listStacks(characterId), []);
  });

  test('two purchases at the same time cannot spend the same money twice', async () => {
    await characterStore.addCopper(characterId, ITEMS.linenCloth.buyPrice);

    const results = await Promise.all([
      shopStore.buyItem(characterId, 'mossbeardGoods', 'linenCloth'),
      shopStore.buyItem(characterId, 'mossbeardGoods', 'linenCloth'),
    ]);

    assert.equal(results.filter((result) => result.error).length, 1);
    assert.equal(await characterStore.findCopper(characterId), 0);
  });

  test('a sold stack leaves the bags and its sell price is added to the money', async () => {
    const inventoryStore = createInventoryStore(testSchema.pool);
    await inventoryStore.changeStacks(characterId, () => ({ stacks: [{ slot: 4, itemId: 'wolfPelt', quantity: 3 }] }));

    const result = await shopStore.sellStack(characterId, 4);

    const price = 3 * ITEMS.wolfPelt.sellPrice;
    assert.deepEqual(result.sale, { itemId: 'wolfPelt', quantity: 3, price });
    assert.deepEqual(await inventoryStore.listStacks(characterId), []);
    assert.equal(await characterStore.findCopper(characterId), price);
  });

  test('a sale bought back returns the stack and takes the money back', async () => {
    const inventoryStore = createInventoryStore(testSchema.pool);
    await inventoryStore.changeStacks(characterId, () => ({ stacks: [{ slot: 0, itemId: 'wolfPelt', quantity: 3 }] }));
    const { sale } = await shopStore.sellStack(characterId, 0);

    await shopStore.buyBack(characterId, sale);

    assert.deepEqual(await inventoryStore.listStacks(characterId), [{ slot: 0, itemId: 'wolfPelt', quantity: 3 }]);
    assert.equal(await characterStore.findCopper(characterId), 0);
  });
});
