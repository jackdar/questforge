import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../src/database.js';
import { createAccountStore } from '../src/account-store.js';
import { createCharacterStore } from '../src/character-store.js';
import { createQuestStore } from '../src/quest-store.js';
import { createInventoryStore } from '../src/inventory-store.js';
import { addToBags } from 'questforge-shared/inventory-rules.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations', import.meta.url));
const newCharacter = { name: 'Jaina', faction: 'dawnguard', level: 1 };
const activeFirstQuest = { wolvesAtTheDoor: { status: 'active', progress: [] } };

describe('quest store', databaseTestOptions, () => {
  let testSchema;
  let questStore;
  let characterId;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    await runMigrations(testSchema.pool, MIGRATIONS_DIRECTORY, { log: () => {} });
    const { account } = await createAccountStore(testSchema.pool).createAccount('Alice', 'not-a-real-hash');
    const { character } = await createCharacterStore(testSchema.pool).createCharacter(account.id, newCharacter);
    characterId = character.id;
    questStore = createQuestStore(testSchema.pool);
  });

  afterEach(async () => {
    await testSchema.drop();
  });

  test('a new character has an empty quest log', async () => {
    assert.deepEqual(await questStore.listQuestLog(characterId), {});
  });

  test('an accepted quest is saved as active with no progress', async () => {
    const result = await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    assert.deepEqual(result, { questLog: activeFirstQuest });
    assert.deepEqual(await questStore.listQuestLog(characterId), activeFirstQuest);
  });

  test('a quest cannot be accepted twice', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    const result = await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    assert.deepEqual(result, { error: 'You cannot accept that quest.' });
  });

  test('a quest cannot be accepted before the quests it requires are complete', async () => {
    const result = await questStore.acceptQuest(characterId, 'peltsForTheTanner');

    assert.deepEqual(result, { error: 'You cannot accept that quest.' });
    assert.deepEqual(await questStore.listQuestLog(characterId), {});
  });

  test('an unknown quest cannot be accepted', async () => {
    assert.deepEqual(await questStore.acceptQuest(characterId, 'notAQuest'), { error: 'That quest does not exist.' });
  });

  test('an abandoned quest leaves the quest log, so it can be accepted again', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    const abandoned = await questStore.abandonQuest(characterId, 'wolvesAtTheDoor');
    const acceptedAgain = await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    assert.deepEqual(abandoned, { questLog: {} });
    assert.deepEqual(acceptedAgain, { questLog: activeFirstQuest });
  });

  test('a quest that the character is not on cannot be abandoned', async () => {
    assert.deepEqual(await questStore.abandonQuest(characterId, 'wolvesAtTheDoor'), {
      error: 'You are not on that quest.',
    });
  });

  test('a kill for an active quest adds to its saved progress', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    await questStore.recordKill(characterId, 'wolf');
    const result = await questStore.recordKill(characterId, 'wolf');

    const expectedLog = { wolvesAtTheDoor: { status: 'active', progress: [2] } };
    assert.deepEqual(result, { questLog: expectedLog });
    assert.deepEqual(await questStore.listQuestLog(characterId), expectedLog);
  });

  test('a kill that counts for no quest saves nothing', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    const result = await questStore.recordKill(characterId, 'bear');

    assert.deepEqual(result, { questLog: null });
    assert.deepEqual(await questStore.listQuestLog(characterId), activeFirstQuest);
  });

  test('a finished kill quest turns in, and the saved row records its completion', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');
    for (let kill = 0; kill < 5; kill++) await questStore.recordKill(characterId, 'wolf');

    const result = await questStore.turnInQuest(characterId, 'wolvesAtTheDoor');

    const completedLog = { wolvesAtTheDoor: { status: 'completed', progress: [5] } };
    assert.deepEqual(result, { questLog: completedLog, stacks: [], experience: { level: 2, xp: 50 } });
    const { rows } = await testSchema.pool.query('SELECT completed_at FROM character_quests WHERE quest_id = $1', [
      'wolvesAtTheDoor',
    ]);
    assert.ok(rows[0].completed_at instanceof Date);
  });

  test('a collect quest turn-in takes the items and gives the reward items in one save', async () => {
    const inventoryStore = createInventoryStore(testSchema.pool);
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');
    for (let kill = 0; kill < 5; kill++) await questStore.recordKill(characterId, 'wolf');
    await questStore.turnInQuest(characterId, 'wolvesAtTheDoor');
    await questStore.acceptQuest(characterId, 'peltsForTheTanner');
    await inventoryStore.changeStacks(characterId, (stacks) => addToBags(stacks, { itemId: 'wolfPelt', quantity: 3 }));

    await questStore.turnInQuest(characterId, 'peltsForTheTanner');

    assert.deepEqual(await inventoryStore.listStacks(characterId), [
      { slot: 0, itemId: 'wornLeatherBoots', quantity: 1 },
    ]);
    assert.equal((await questStore.listQuestLog(characterId)).peltsForTheTanner.status, 'completed');
  });

  test('a turn-in saves the xp reward and any level it gives to the character', async () => {
    const characterStore = createCharacterStore(testSchema.pool);
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');
    for (let kill = 0; kill < 5; kill++) await questStore.recordKill(characterId, 'wolf');

    await questStore.turnInQuest(characterId, 'wolvesAtTheDoor');

    // Wolves at the Door gives 150 xp. Level 1 needs 100, so the character reaches level 2 with 50 xp left.
    assert.deepEqual(await characterStore.findExperience(characterId), { level: 2, xp: 50 });
  });

  test('a new character starts at level 1 with no xp', async () => {
    assert.deepEqual(await createCharacterStore(testSchema.pool).findExperience(characterId), { level: 1, xp: 0 });
  });

  test('an unfinished quest cannot be turned in and stays active', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');

    const result = await questStore.turnInQuest(characterId, 'wolvesAtTheDoor');

    assert.deepEqual(result, { error: 'That quest is not complete.' });
    assert.deepEqual(await questStore.listQuestLog(characterId), activeFirstQuest);
  });

  test('a completed quest cannot be turned in again or abandoned', async () => {
    await questStore.acceptQuest(characterId, 'wolvesAtTheDoor');
    for (let kill = 0; kill < 5; kill++) await questStore.recordKill(characterId, 'wolf');
    await questStore.turnInQuest(characterId, 'wolvesAtTheDoor');

    assert.deepEqual(await questStore.turnInQuest(characterId, 'wolvesAtTheDoor'), {
      error: 'That quest is not complete.',
    });
    assert.deepEqual(await questStore.abandonQuest(characterId, 'wolvesAtTheDoor'), {
      error: 'You are not on that quest.',
    });
  });
});
