import { OVERWORLD_TERRAIN, WORLD_MAX_HEIGHT } from 'questforge-shared/terrain.js';
import { CREATURES } from 'questforge-shared/creatures.js';
import { playerMaxHealth } from 'questforge-shared/leveling.js';

export const MAX_HEALTH = 100;
export const MAX_MANA = 100;
export const DUMMY_LEVEL = 1;

// Each map has its own world with its own terrain. A player enters at the given place, such as the arrival point of
// a portal, and always respawns at the spawn point of the map.
export function createWorldState({ terrain = OVERWORLD_TERRAIN, playerSpawn = { x: 0, z: 0, rotation: 0 } } = {}) {
  const { groundHeightAt, halfSize } = terrain;
  const entities = new Map();
  const spawns = new Map();

  function withGroundHeight(place) {
    return { ...place, y: place.y ?? groundHeightAt(place.x, place.z) };
  }

  function addEntity(fields, spawnWithoutHeight, { maxHealth = MAX_HEALTH, maxMana = MAX_MANA } = {}) {
    const spawn = withGroundHeight(spawnWithoutHeight);
    const entity = {
      ...fields,
      ...spawn,
      health: maxHealth,
      maxHealth,
      mana: maxMana,
      maxMana,
    };
    entities.set(entity.id, entity);
    spawns.set(entity.id, spawn);
    return { ...entity };
  }

  function addPlayer(id, name, faction, level, place = playerSpawn) {
    const fields = { id, kind: 'player', name, faction, level };
    const player = addEntity(fields, place, { maxHealth: playerMaxHealth(level) });
    spawns.set(id, withGroundHeight(playerSpawn));
    return player;
  }

  function addDummy(id, spawn) {
    return addEntity({ id, kind: 'dummy', name: 'Training Dummy', faction: null, level: DUMMY_LEVEL }, spawn);
  }

  // Creatures fight with melee attacks only, so they have no mana.
  function addCreature(id, kind, spawn, { level = CREATURES[kind].level } = {}) {
    const { name, maxHealth } = CREATURES[kind];
    const fields = { id, kind, name, faction: null, level, isEvading: false, lootableBy: [] };
    return addEntity(fields, spawn, { maxHealth, maxMana: 0 });
  }

  // An NPC stands in one place and cannot fight, so it has no mana.
  function addNpc({ id, name, appearance, level, x, z, rotation }) {
    const fields = { id, kind: 'npc', name, faction: null, level, appearance };
    return addEntity(fields, { x, z, rotation }, { maxMana: 0 });
  }

  // A creature that a boss called goes away when the boss resets.
  function removeCreature(id) {
    const creature = entities.get(id);
    if (!creature || !CREATURES[creature.kind]) return false;
    spawns.delete(id);
    return entities.delete(id);
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

    player.x = clamp(x, -halfSize, halfSize);
    player.z = clamp(z, -halfSize, halfSize);
    player.y = clamp(y, groundHeightAt(player.x, player.z), WORLD_MAX_HEIGHT);
    player.rotation = rotation;
    return true;
  }

  // The server moves creatures itself, so they always stand on the ground inside the world.
  function moveCreature(id, { x, z, rotation }) {
    const creature = entities.get(id);
    if (!creature || creature.kind === 'player' || creature.health === 0) return false;

    creature.x = clamp(x, -halfSize, halfSize);
    creature.z = clamp(z, -halfSize, halfSize);
    creature.y = groundHeightAt(creature.x, creature.z);
    creature.rotation = rotation;
    return true;
  }

  // As in WoW, a new level raises the health and refills the health and mana. A dead player stays dead.
  function setLevel(id, level) {
    const player = entities.get(id);
    if (player?.kind !== 'player') return false;
    const isLevelUp = level > player.level;
    player.level = level;
    player.maxHealth = playerMaxHealth(level);
    if (isLevelUp && player.health > 0) {
      player.health = player.maxHealth;
      player.mana = player.maxMana;
    }
    player.health = Math.min(player.health, player.maxHealth);
    return true;
  }

  function setEvading(id, isEvading) {
    const creature = entities.get(id);
    if (!creature || creature.kind === 'player') return false;
    creature.isEvading = isEvading;
    return true;
  }

  // The ids of the players who can loot this corpse, or an empty list. Clients show sparkles to those players.
  function setLootableBy(id, playerIds) {
    const creature = entities.get(id);
    if (!creature || creature.kind === 'player') return false;
    creature.lootableBy = [...playerIds];
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
    movementSpeedFactorAt: terrain.movementSpeedFactorAt,
    addPlayer,
    addDummy,
    addCreature,
    addNpc,
    removeCreature,
    removePlayer,
    getEntity,
    movePlayer,
    moveCreature,
    setLevel,
    setEvading,
    setLootableBy,
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
