import { QUESTS } from 'questforge-shared/quests.js';
import { applyQuestTurnIn, countKill, getQuestStatus } from 'questforge-shared/quest-rules.js';
import { runLockedForCharacter } from './character-lock.js';
import { addXp } from 'questforge-shared/leveling.js';
import { saveStacks, selectStacks } from './inventory-store.js';
import { saveExperience, selectExperience } from './character-store.js';

export function createQuestStore(pool) {
  async function listQuestLog(characterId) {
    return selectQuestLog(pool, characterId);
  }

  // The status check and the insert run under the character lock, so that the same quest cannot be accepted twice.
  // Only the status of an available quest matters here, and it does not depend on the bags.
  async function acceptQuest(characterId, questId) {
    if (!Object.hasOwn(QUESTS, questId)) return { error: 'That quest does not exist.' };
    return runLockedForCharacter(pool, characterId, async (client) => {
      const questLog = await selectQuestLog(client, characterId);
      if (getQuestStatus(questId, questLog, []) !== 'available') return { error: 'You cannot accept that quest.' };

      await client.query(
        `INSERT INTO character_quests (character_id, quest_id, status, progress) VALUES ($1, $2, 'active', '[]')`,
        [characterId, questId],
      );
      return { questLog: await selectQuestLog(client, characterId) };
    });
  }

  // The row goes away, so the quest giver offers the quest again from the start.
  async function abandonQuest(characterId, questId) {
    const { rowCount } = await pool.query(
      `DELETE FROM character_quests WHERE character_id = $1 AND quest_id = $2 AND status = 'active'`,
      [characterId, questId],
    );
    if (rowCount === 0) return { error: 'You are not on that quest.' };
    return { questLog: await selectQuestLog(pool, characterId) };
  }

  // Returns { questLog } when the kill counted for a quest, or { questLog: null } when it counted for nothing.
  async function recordKill(characterId, creatureKind) {
    return runLockedForCharacter(pool, characterId, async (client) => {
      const changedProgress = countKill(await selectQuestLog(client, characterId), creatureKind);
      if (Object.keys(changedProgress).length === 0) return { questLog: null };

      for (const [questId, progress] of Object.entries(changedProgress)) {
        await client.query('UPDATE character_quests SET progress = $3 WHERE character_id = $1 AND quest_id = $2', [
          characterId,
          questId,
          JSON.stringify(progress),
        ]);
      }
      return { questLog: await selectQuestLog(client, characterId) };
    });
  }

  // The bags, the quest log, and the xp change together, so a failed save cannot take the items without completing
  // the quest. The completed row is the record that the character completed the quest.
  async function turnInQuest(characterId, questId) {
    if (!Object.hasOwn(QUESTS, questId)) return { error: 'That quest does not exist.' };
    return runLockedForCharacter(pool, characterId, async (client) => {
      const questLog = await selectQuestLog(client, characterId);
      const result = applyQuestTurnIn(questId, questLog, await selectStacks(client, characterId));
      if (result.error) return result;

      await saveStacks(client, characterId, result.stacks);
      const experience = addXp(await selectExperience(client, characterId), QUESTS[questId].rewards.xp);
      await saveExperience(client, characterId, experience);
      await client.query(
        `UPDATE character_quests SET status = 'completed', completed_at = now()
         WHERE character_id = $1 AND quest_id = $2`,
        [characterId, questId],
      );
      return { questLog: await selectQuestLog(client, characterId), stacks: result.stacks, experience };
    });
  }

  return { listQuestLog, acceptQuest, abandonQuest, recordKill, turnInQuest };
}

async function selectQuestLog(queryable, characterId) {
  const { rows } = await queryable.query(
    'SELECT quest_id, status, progress FROM character_quests WHERE character_id = $1',
    [characterId],
  );
  return Object.fromEntries(rows.map((row) => [row.quest_id, { status: row.status, progress: row.progress }]));
}
