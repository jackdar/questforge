// The work gets a database client inside a transaction and returns a result. A result with an error saves nothing.
// The lock on the character row makes two changes to the same character, such as a loot and a quest turn-in,
// run one at a time.
export async function runLockedForCharacter(pool, characterId, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM characters WHERE id = $1 FOR UPDATE', [characterId]);
    const result = await work(client);
    await client.query(result.error ? 'ROLLBACK' : 'COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
