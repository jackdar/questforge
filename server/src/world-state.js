import { groundHeightAt, WORLD_MAX_HEIGHT } from 'questforge-shared/terrain.js';

export const WORLD_HALF_SIZE = 100;
export const MAX_HEALTH = 100;
export const MAX_MANA = 100;
export const DUMMY_LEVEL = 1;

const PLAYER_SPAWN = { x: 0, y: 0, z: 0, rotation: 0 };

export function createWorldState() {
  const entities = new Map();
  const spawns = new Map();

  function addEntity(fields, spawnWithoutHeight) {
    const spawn = { ...spawnWithoutHeight, y: spawnWithoutHeight.y ?? groundHeightAt(spawnWithoutHeight.x, spawnWithoutHeight.z) };
    const entity = {
      ...fields,
      ...spawn,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      mana: MAX_MANA,
      maxMana: MAX_MANA,
    };
    entities.set(entity.id, entity);
    spawns.set(entity.id, spawn);
    return { ...entity };
  }

  function addPlayer(id, name, faction, level) {
    return addEntity({ id, kind: 'player', name, faction, level }, PLAYER_SPAWN);
  }

  function addDummy(id, spawn) {
    return addEntity({ id, kind: 'dummy', name: 'Training Dummy', faction: null, level: DUMMY_LEVEL }, spawn);
  }

  function removePlayer(id) {
    if (entities.get(id)?.kind !== 'player') return false;
    spawns.delete(id);
    return entities.delete(id);
  }

  function getEntity(id) {
    const entity = entities.get(id);
    return entity ? { ...entity } : undefined;
  }

  // The client runs jumps and falls, as in WoW. The server keeps the height between the ground and the world ceiling.
  function movePlayer(id, { x, y, z, rotation }) {
    const player = entities.get(id);
    if (player?.kind !== 'player' || player.health === 0) return false;
    if (![x, y, z, rotation].every(Number.isFinite)) return false;

    player.x = clamp(x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    player.z = clamp(z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    player.y = clamp(y, groundHeightAt(player.x, player.z), WORLD_MAX_HEIGHT);
    player.rotation = rotation;
    return true;
  }

  function changeHealth(id, amount) {
    const entity = entities.get(id);
    if (!entity) return undefined;

    entity.health = clamp(entity.health + amount, 0, entity.maxHealth);
    // A dead entity cannot move, so one that dies in the air drops to the ground.
    if (entity.health === 0) entity.y = groundHeightAt(entity.x, entity.z);
    return entity.health;
  }

  function spendMana(id, amount) {
    const entity = entities.get(id);
    if (!entity || entity.mana < amount) return false;

    entity.mana -= amount;
    return true;
  }

  function regenerateMana(amount) {
    for (const entity of entities.values()) {
      if (entity.health > 0) entity.mana = Math.min(entity.mana + amount, entity.maxMana);
    }
  }

  function respawn(id) {
    const entity = entities.get(id);
    if (!entity) return undefined;

    Object.assign(entity, spawns.get(id), { health: entity.maxHealth, mana: entity.maxMana });
    return { ...entity };
  }

  function snapshot() {
    return [...entities.values()].map((entity) => ({ ...entity }));
  }

  return {
    addPlayer,
    addDummy,
    removePlayer,
    getEntity,
    movePlayer,
    changeHealth,
    spendMana,
    regenerateMana,
    respawn,
    snapshot,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
