import { runLockedForCharacter } from './character-lock.js';

export function createInventoryStore(pool) {
  async function listStacks(characterId) {
    return selectStacks(pool, characterId);
  }

  // The change gets the current stacks and returns { stacks } to save or { error } to save nothing.
  async function changeStacks(characterId, change) {
    return runLockedForCharacter(pool, characterId, async (client) => {
      const result = change(await selectStacks(client, characterId));
      if (!result.error) await saveStacks(client, characterId, result.stacks);
      return result;
    });
  }

  return { listStacks, changeStacks };
}

export async function selectStacks(queryable, characterId) {
  const { rows } = await queryable.query(
    'SELECT slot, item_id, quantity FROM character_items WHERE character_id = $1 ORDER BY slot',
    [characterId],
  );
  return rows.map((row) => ({ slot: row.slot, itemId: row.item_id, quantity: row.quantity }));
}

// The bags hold at most a few rows, so the save replaces all of them.
export async function saveStacks(client, characterId, stacks) {
  await client.query('DELETE FROM character_items WHERE character_id = $1', [characterId]);
  for (const { slot, itemId, quantity } of stacks) {
    await client.query('INSERT INTO character_items (character_id, slot, item_id, quantity) VALUES ($1, $2, $3, $4)', [
      characterId,
      slot,
      itemId,
      quantity,
    ]);
  }
}
