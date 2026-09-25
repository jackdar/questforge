import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/database.js';
import { createAccountStore } from '../src/account-store.js';
import { createCharacterStore } from '../src/character-store.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));
const newCharacter = { name: 'Jaina', faction: 'dawnguard', level: 1 };

describe('character experience', databaseTestOptions, () => {
  let testSchema;
  let characterStore;
  let characterId;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    characterStore = createCharacterStore(testSchema.pool);
    const { character } = await characterStore.createCharacter(account.id, newCharacter);
    characterId = character.id;
  });

  afterEach(async () => {
    await testSchema.drop();
  });

  test('gained xp is saved as progress into the current level', async () => {
    const result = await characterStore.gainXp(characterId, 20);

    assert.deepEqual(result, { experience: { level: 1, xp: 20 } });
    assert.deepEqual(await characterStore.findExperience(characterId), { level: 1, xp: 20 });
  });

  test('gained xp that reaches the next level saves the new level', async () => {
    await characterStore.gainXp(characterId, 90);
    await characterStore.gainXp(characterId, 20);

    assert.deepEqual(await characterStore.findExperience(characterId), { level: 2, xp: 10 });
  });

  test('two xp gains at the same time both count', async () => {
    await Promise.all([characterStore.gainXp(characterId, 20), characterStore.gainXp(characterId, 20)]);

    assert.deepEqual(await characterStore.findExperience(characterId), { level: 1, xp: 40 });
  });
});

describe('character money', databaseTestOptions, () => {
  let testSchema;
  let characterStore;
  let characterId;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    characterStore = createCharacterStore(testSchema.pool);
    const { character } = await characterStore.createCharacter(account.id, newCharacter);
    characterId = character.id;
  });

  afterEach(async () => {
    await testSchema.drop();
  });

  test('a new character has no money', async () => {
    assert.equal(await characterStore.findCopper(characterId), 0);
  });

  test('added money is saved and returns the new total', async () => {
    await characterStore.addCopper(characterId, 1_05);

    assert.equal(await characterStore.addCopper(characterId, 20), 1_25);
    assert.equal(await characterStore.findCopper(characterId), 1_25);
  });

  test('two money gains at the same time both count', async () => {
    await Promise.all([characterStore.addCopper(characterId, 10), characterStore.addCopper(characterId, 15)]);

    assert.equal(await characterStore.findCopper(characterId), 25);
  });
});
