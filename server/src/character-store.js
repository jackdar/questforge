import { addXp } from 'questforge-shared/leveling.js';
import { runLockedForCharacter } from './character-lock.js';

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

  async function findExperience(characterId) {
    return selectExperience(pool, characterId);
  }

  // The lock stops a kill and a quest turn-in at the same time from each saving xp over the other.
  async function gainXp(characterId, gainedXp) {
    return runLockedForCharacter(pool, characterId, async (client) => {
      const experience = addXp(await selectExperience(client, characterId), gainedXp);
      await saveExperience(client, characterId, experience);
      return { experience };
    });
  }

  async function findCopper(characterId) {
    const { rows } = await pool.query('SELECT copper FROM characters WHERE id = $1', [characterId]);
    return rows[0].copper;
  }

  // One statement adds the money, so two gains at the same time cannot save over each other.
  async function addCopper(characterId, copper) {
    const { rows } = await pool.query('UPDATE characters SET copper = copper + $2 WHERE id = $1 RETURNING copper', [
      characterId,
      copper,
    ]);
    return rows[0].copper;
  }

  // Returns null for a character that has not saved a place yet.
  async function findLastPosition(characterId) {
    const { rows } = await pool.query(
      'SELECT map_id, position_x, position_z, rotation FROM characters WHERE id = $1 AND map_id IS NOT NULL',
      [characterId],
    );
    if (!rows[0]) return null;
    const { map_id: mapId, position_x: x, position_z: z, rotation } = rows[0];
    return { mapId, x, z, rotation };
  }

  async function saveLastPosition(characterId, { mapId, x, z, rotation }) {
    await pool.query(
      'UPDATE characters SET map_id = $2, position_x = $3, position_z = $4, rotation = $5 WHERE id = $1',
      [characterId, mapId, x, z, rotation],
    );
  }

  return {
    createCharacter,
    listCharacters,
    findCharacterForAccount,
    findExperience,
    gainXp,
    findCopper,
    addCopper,
    findLastPosition,
    saveLastPosition,
  };
}

export async function selectExperience(queryable, characterId) {
  const { rows } = await queryable.query('SELECT level, xp FROM characters WHERE id = $1', [characterId]);
  return { level: rows[0].level, xp: rows[0].xp };
}

export async function saveExperience(client, characterId, { level, xp }) {
  await client.query('UPDATE characters SET level = $2, xp = $3 WHERE id = $1', [characterId, level, xp]);
}

export async function selectCopper(queryable, characterId) {
  const { rows } = await queryable.query('SELECT copper FROM characters WHERE id = $1', [characterId]);
  return rows[0].copper;
}

export async function saveCopper(client, characterId, copper) {
  await client.query('UPDATE characters SET copper = $2 WHERE id = $1', [characterId, copper]);
}

function toCharacter(row) {
  return { id: String(row.id), name: row.name, faction: row.faction, level: row.level };
}
