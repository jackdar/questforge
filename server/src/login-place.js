import { MAPS, PORTALS } from 'questforge-shared/maps.js';

// Where a character enters the world when it logs in. It is the overworld place where it last stood. A character that
// logged out inside an instance, such as the cave, comes back outside the entrance, because that instance is gone,
// as in WoW. A character that has not played yet starts at the spawn of the overworld.
export function loginPlaceFor(lastPosition) {
  const { overworld } = MAPS;
  if (!lastPosition) return overworld.spawn;

  if (lastPosition.mapId !== overworld.id) {
    const exit = PORTALS.find((portal) => portal.mapId === lastPosition.mapId && portal.toMapId === overworld.id);
    return exit?.arrival ?? overworld.spawn;
  }

  const { minX, maxX, minZ, maxZ } = overworld.terrain.bounds;
  const { x, z, rotation } = lastPosition;
  const isInsideMap = Number.isFinite(x) && Number.isFinite(z) && x >= minX && x <= maxX && z >= minZ && z <= maxZ;
  if (!isInsideMap) return overworld.spawn;
  return { x, z, rotation: Number.isFinite(rotation) ? rotation : 0 };
}
