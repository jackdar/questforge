import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addToBags, moveStack } from 'questforge-shared/inventory-rules.js';
import { runMigrations } from '../src/database.js';
import { createAccountStore } from '../src/account-store.js';
import { createCharacterStore } from '../src/character-store.js';
import { createInventoryStore } from '../src/inventory-store.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));
const MIGRATIONS_BEFORE_BAG_SLOTS = [
  '001_create_accounts_and_sessions.sql',
  '002_create_characters.sql',
  '003_create_character_items.sql',
];
const newCharacter = { name: 'Jaina', faction: 'dawnguard', level: 1 };

describe('inventory store', databaseTestOptions, () => {
  let testSchema;
  let inventoryStore;
  let characterId;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    const { character } = await createCharacterStore(testSchema.pool).createCharacter(account.id, newCharacter);
    characterId = character.id;
    inventoryStore = createInventoryStore(testSchema.pool);
  });

  afterEach(async () => {
    await testSchema.drop();
  });

  test('a new character has empty bags', async () => {
    assert.deepEqual(await inventoryStore.listStacks(characterId), []);
  });

  test('a change to the bags is saved', async () => {
    await inventoryStore.changeStacks(characterId, (stacks) => addToBags(stacks, { itemId: 'wolfPelt', quantity: 1 }));
    await inventoryStore.changeStacks(characterId, (stacks) => moveStack(stacks, 0, 7));

    assert.deepEqual(await inventoryStore.listStacks(characterId), [{ slot: 7, itemId: 'wolfPelt', quantity: 1 }]);
  });

  test('a refused change saves nothing and returns its error', async () => {
    await inventoryStore.changeStacks(characterId, (stacks) => addToBags(stacks, { itemId: 'wolfPelt', quantity: 1 }));

    const result = await inventoryStore.changeStacks(characterId, (stacks) => moveStack(stacks, 3, 4));

    assert.deepEqual(result, { error: 'That bag slot is empty.' });
    assert.deepEqual(await inventoryStore.listStacks(characterId), [{ slot: 0, itemId: 'wolfPelt', quantity: 1 }]);
  });

  test('two changes at the same time both apply, one after the other', async () => {
    const addFang = (stacks) => addToBags(stacks, { itemId: 'wolfFang', quantity: 1 });

    await Promise.all([
      inventoryStore.changeStacks(characterId, addFang),
      inventoryStore.changeStacks(characterId, addFang),
    ]);

    assert.deepEqual(await inventoryStore.listStacks(characterId), [{ slot: 0, itemId: 'wolfFang', quantity: 2 }]);
  });
});

describe('bag slot migration', databaseTestOptions, () => {
  let testSchema;
  let olderMigrationsDirectory;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    olderMigrationsDirectory = await mkdtemp(path.join(tmpdir(), 'questforge-migrations-'));
    for (const file of MIGRATIONS_BEFORE_BAG_SLOTS) {
      await cp(path.join(MIGRATIONS_DIRECTORY, file), path.join(olderMigrationsDirectory, file));
    }
  });

  afterEach(async () => {
    await testSchema.drop();
    await rm(olderMigrationsDirectory, { recursive: true });
  });

  test('items saved before bag slots existed get the slots 0, 1, 2 in item order', async () => {
    await runMigrations(testSchema.pool, olderMigrationsDirectory, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    const { character } = await createCharacterStore(testSchema.pool).createCharacter(account.id, newCharacter);
    await testSchema.pool.query(
      `INSERT INTO character_items (character_id, item_id, quantity) VALUES ($1, 'wolfPelt', 2), ($1, 'wolfFang', 5)`,
      [character.id],
    );

    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });

    assert.deepEqual(await createInventoryStore(testSchema.pool).listStacks(character.id), [
      { slot: 0, itemId: 'wolfFang', quantity: 5 },
      { slot: 1, itemId: 'wolfPelt', quantity: 2 },
    ]);
  });
});
