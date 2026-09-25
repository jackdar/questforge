import { MAPS } from 'questforge-shared/maps.js';

// An empty instance closes after this long, so the next visit starts fresh.
export const EMPTY_INSTANCE_LIFETIME_MS = 5 * 60 * 1000;

// Keeps the running map instances. The overworld has one shared instance. A player who enters an instance map joins
// the instance of their party: the one that a party member is in, or the one that the party owns. Otherwise the
// player starts a new instance that belongs to their party.
export function createInstances({ createInstance, parties }) {
  const instancesById = new Map();
  let instanceCount = 0;

  function start(mapId, ownerIds) {
    instanceCount += 1;
    const instance = createInstance({ id: `${mapId}-${instanceCount}`, mapId, ownerIds });
    instancesById.set(instance.id, instance);
    return instance;
  }

  const overworld = start('overworld', []);

  function instanceFor(mapId, playerId) {
    if (!MAPS[mapId].isInstance) return overworld;

    const partyIds = parties.membersOf(playerId);
    const partyInstance = [...instancesById.values()].find(
      (instance) =>
        instance.mapId === mapId &&
        [...instance.playerIds(), ...instance.ownerIds].some((memberId) => partyIds.includes(memberId)),
    );
    return partyInstance ?? start(mapId, partyIds);
  }

  function closeEmptyInstances(now) {
    for (const instance of instancesById.values()) {
      const emptySince = instance.emptySince();
      if (instance === overworld || emptySince === null) continue;
      if (now - emptySince >= EMPTY_INSTANCE_LIFETIME_MS) instancesById.delete(instance.id);
    }
  }

  return { overworld, instanceFor, closeEmptyInstances, all: () => [...instancesById.values()] };
}
