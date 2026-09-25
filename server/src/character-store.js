const UNIQUE_VIOLATION = '23505';
const CHARACTER_COLUMNS = 'id, name, faction, level';

export function createCharacterStore(pool) {
  async function createCharacter(accountId, { name, faction, level }) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO characters (account_id, name, faction, level) VALUES ($1, $2, $3, $4) RETURNING ${CHARACTER_COLUMNS}`,
        [accountId, name, faction, level],
      );
      return { character: toCharacter(rows[0]) };
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: 'That name is taken.' };
      throw error;
    }
  }

  async function listCharacters(accountId) {
    const { rows } = await pool.query(
      `SELECT ${CHARACTER_COLUMNS} FROM characters WHERE account_id = $1 ORDER BY created_at, id`,
      [accountId],
    );
    return rows.map(toCharacter);
  }

  // Returns null for a character of another account, so that nobody can play a character they do not own.
  async function findCharacterForAccount(characterId, accountId) {
    if (!/^\d+$/.test(String(characterId))) return null;

    const { rows } = await pool.query(`SELECT ${CHARACTER_COLUMNS} FROM characters WHERE id = $1 AND account_id = $2`, [
      characterId,
      accountId,
    ]);
    return rows[0] ? toCharacter(rows[0]) : null;
  }

  return { createCharacter, listCharacters, findCharacterForAccount };
}

function toCharacter(row) {
  return { id: String(row.id), name: row.name, faction: row.faction, level: row.level };
}
