import { CAVE_MOUTH, OVERWORLD_TERRAIN } from './terrain.js';
import { CAVE_TERRAIN } from './cave-terrain.js';

// A map is a separate world. The overworld is one shared world. An instance map, such as the cave, starts a new world
// for each party, and its creatures stay dead once killed. A player who dies returns to the spawn of the map.
export const MAPS = {
  overworld: {
    id: 'overworld',
    name: 'Redpine Vale',
    terrain: OVERWORLD_TERRAIN,
    spawn: { x: 0, z: 0, rotation: 0 },
    isInstance: false,
    creaturesRespawn: true,
    songId: 'overworld',
  },
  spiderCave: {
    id: 'spiderCave',
    name: 'Webwood Hollow',
    terrain: CAVE_TERRAIN,
    spawn: { x: 0, z: -40, rotation: 0 },
    isInstance: true,
    creaturesRespawn: false,
    songId: 'cave',
  },
};

// A player who walks into a portal goes to its arrival point on the other map. Each arrival point stands clear of
// the portals, so a player does not bounce straight back.
export const PORTAL_RADIUS = 2.5;
const CAVE_PORTAL = { x: CAVE_MOUTH.toX - 3, z: CAVE_MOUTH.toZ - 3 };
const FACING_AWAY_FROM_CAVE = Math.atan2(-1, -1);

export const PORTALS = [
  {
    id: 'caveEntrance',
    mapId: 'overworld',
    x: CAVE_PORTAL.x,
    z: CAVE_PORTAL.z,
    // The ring faces down the cave mouth, toward the player who walks in.
    rotation: Math.PI / 4,
    toMapId: 'spiderCave',
    arrival: MAPS.spiderCave.spawn,
  },
  {
    id: 'caveExit',
    mapId: 'spiderCave',
    x: 0,
    z: -46,
    rotation: 0,
    toMapId: 'overworld',
    arrival: { x: CAVE_PORTAL.x - 12, z: CAVE_PORTAL.z - 12, rotation: FACING_AWAY_FROM_CAVE },
  },
];

export function portalAt(mapId, { x, z }) {
  return PORTALS.find((portal) => portal.mapId === mapId && Math.hypot(x - portal.x, z - portal.z) <= PORTAL_RADIUS);
}
