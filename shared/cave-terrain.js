import { squareBounds } from './terrain.js';

// The spider cave is a separate, fully enclosed map. Its floor is flat, and its walls are ground that rises far too
// steeply to walk up, so the slope limit keeps players inside, as the mountains do in the overworld.
// The cave is a winding passage of tunnels and chambers. Each point on the path has a radius: the floor reaches
// that far from the path, and a tunnel between two points widens or narrows from one radius to the other.
export const CAVE_PATH = [
  { x: 0, z: -48, radius: 6 },
  { x: 0, z: -32, radius: 5 },
  { x: -14, z: -16, radius: 11 },
  { x: 4, z: 2, radius: 5 },
  { x: 18, z: 18, radius: 11 },
  { x: 6, z: 34, radius: 5 },
  { x: -8, z: 50, radius: 16 },
];
// The chambers are the wide points of the path. The last chamber is the lair of the Broodmother.
export const SPIDER_CHAMBERS = [CAVE_PATH[2], CAVE_PATH[4]];
export const BOSS_CHAMBER = CAVE_PATH[6];

const WALL_HEIGHT = 14;
const WALL_RISE_DISTANCE = 3;
export const CAVE_CEILING_HEIGHT = 12;

export function caveGroundHeightAt(x, z) {
  const t = Math.min(distanceOutsideCave(x, z) / WALL_RISE_DISTANCE, 1);
  return WALL_HEIGHT * t * t * (3 - 2 * t);
}

// How far a point lies outside the floor of the cave, or 0 on the floor.
export function distanceOutsideCave(x, z) {
  let nearest = Infinity;
  for (let index = 0; index < CAVE_PATH.length - 1; index++) {
    nearest = Math.min(nearest, distanceOutsideTunnel(x, z, CAVE_PATH[index], CAVE_PATH[index + 1]));
  }
  return nearest;
}

function distanceOutsideTunnel(x, z, from, to) {
  const lengthSquared = (to.x - from.x) ** 2 + (to.z - from.z) ** 2;
  const projection = (x - from.x) * (to.x - from.x) + (z - from.z) * (to.z - from.z);
  const along = Math.min(Math.max(projection / lengthSquared, 0), 1);
  const distance = Math.hypot(x - (from.x + (to.x - from.x) * along), z - (from.z + (to.z - from.z) * along));
  const radius = from.radius + (to.radius - from.radius) * along;
  return Math.max(distance - radius, 0);
}

const CAVE_HALF_SIZE = 70;

export const CAVE_TERRAIN = {
  halfSize: CAVE_HALF_SIZE,
  bounds: squareBounds(CAVE_HALF_SIZE),
  ceilingHeight: CAVE_CEILING_HEIGHT,
  groundHeightAt: caveGroundHeightAt,
  waterDepthAt: () => 0,
  movementSpeedFactorAt: () => 1,
};
