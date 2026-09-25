import { MAPS } from 'questforge-shared/maps.js';
import { createWorldState } from './world-state.js';
import { createCombat } from './combat.js';
import { createCreatureAi } from './creature-ai.js';
import { createLoot } from './loot.js';
import { playersSharingKill } from './parties.js';
import { populateMap } from './map-spawns.js';

// A map instance is one running copy of a map: its own world, combat, creature AI, and loot. The overworld has one
// instance that every player shares. The cave gets a new instance for each party.
// sendToPlayers(playerIds, message) sends a message to the players of this instance, and onTaggedKill hands out the
// xp and quest credit of a kill.
export function createMapInstance({ id, mapId, ownerIds = [], parties, sendToPlayers, onTaggedKill }) {
  const map = MAPS[mapId];
  const playerIds = new Set();
  let emptySince = null;

  const world = createWorldState({ terrain: map.terrain, playerSpawn: map.spawn });
  const combat = createCombat(world, emitCombatEvent, { creaturesRespawn: map.creaturesRespawn });
  const creatureAi = createCreatureAi(world, combat);
  const loot = createLoot(world, {
    onTaggedKill: (kill) => onTaggedKill(instance, kill),
    lootersFor: (taggerId, corpse) => playersSharingKill(taggerId, corpse, world, parties).map((player) => player.id),
  });
  for (const creatureId of populateMap(mapId, world)) creatureAi.addCreature(creatureId);

  function emitCombatEvent(event) {
    creatureAi.handleCombatEvent(event);
    loot.handleCombatEvent(event);
    sendToPlayers([...playerIds], event);
  }

  function addPlayer(playerId, character, place = map.spawn) {
    playerIds.add(playerId);
    emptySince = null;
    return world.addPlayer(playerId, character.name, character.faction, character.level, place);
  }

  function removePlayer(playerId, now) {
    combat.removeEntity(playerId);
    world.removePlayer(playerId);
    playerIds.delete(playerId);
    if (playerIds.size === 0) emptySince = now;
  }

  function tick(now) {
    combat.tick(now);
    creatureAi.tick(now);
    loot.tick();
    if (playerIds.size > 0) sendToPlayers([...playerIds], { type: 'snapshot', entities: world.snapshot() });
  }

  const instance = {
    id,
    mapId,
    ownerIds: [...ownerIds],
    world,
    combat,
    loot,
    addPlayer,
    removePlayer,
    tick,
    playerIds: () => [...playerIds],
    emptySince: () => emptySince,
  };
  return instance;
}
