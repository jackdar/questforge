import { BANDIT_CAMP } from './places.js';

export const WORLD_HALF_SIZE = 150;
export const WORLD_MAX_HEIGHT = 100;
// A rise of more than this per unit walked is too steep to walk up, as on the steep faces of the mountains.
export const MAX_WALKABLE_SLOPE = 1;

// The meadow around the player spawn is flat. Rolling hills grow from its edge.
const MEADOW_RADIUS = 40;
const ROLLING_HILLS_FULL_RADIUS = 65;
// The bandit camp stands on a flat hilltop. Its slopes are gentle on every side, so a player can walk up anywhere.
const BANDIT_HILL = { topHeight: 8, flatRadius: 26, footRadius: 46 };
// The mountains rise near the edge of the map and form its border.
const MOUNTAINS = { startDistance: 118, fullDistance: 146, height: 36, ridgeHeight: 6 };

// The river winds from the northern mountains down the east side of the map to the southern edge. It cuts its own
// small valley: the bed lies below the valley floor, the banks rise above it, and the valley blends back into the
// land around it. The water stands a little below the valley floor, so the banks always hold it.
export const RIVER = {
  centerX: 92,
  meanderWidth: 10,
  meanderRate: 0.035,
  halfWidth: 4,
  bankWidth: 5,
  valleyBlendWidth: 12,
  bedDepth: 1.4,
  bankTopHeight: 0.6,
  waterBelowValley: 0.4,
};
// Water deeper than this slows a player or a creature to half speed, as they wade.
export const WADING_DEPTH = 0.3;
export const WADING_SPEED_FACTOR = 0.5;

// The cave mouth is a corridor cut into the mountains of the north-east corner, opposite the bandit camp. Its end is
// rounded, so the mountain closes around the portal on three sides.
export const CAVE_MOUTH = { fromX: 110, fromZ: 110, toX: 128, toZ: 128, halfWidth: 5, blendWidth: 8 };

// The bridge crosses the river where it passes level with the player spawn. Its deck arches a little over the water,
// and its ends meet the ground of the banks, so a player can walk on and off it.
export const BRIDGE = { fromX: 79, toX: 105, z: 0, halfWidth: 1.6, archHeight: 0.8 };

// The client and the server both use this function, so they agree on the ground everywhere.
// It uses smooth waves instead of random numbers, so every player sees the same land.
// The deck of the bridge counts as ground, so players and creatures walk on it.
export function groundHeightAt(x, z) {
  const ground = riverGroundHeight(x, z);
  const deck = bridgeDeckHeight(x, z);
  return deck === null ? ground : Math.max(ground, deck);
}

export function riverCenterX(z) {
  return RIVER.centerX + RIVER.meanderWidth * Math.sin(z * RIVER.meanderRate);
}

export function waterLevelAt(z) {
  return landHeight(riverCenterX(z), z) - RIVER.waterBelowValley;
}

// The depth of the river water at a place, or 0 on dry land and on the bridge.
export function waterDepthAt(x, z) {
  if (Math.abs(x - riverCenterX(z)) > RIVER.halfWidth + RIVER.bankWidth) return 0;
  return Math.max(waterLevelAt(z) - groundHeightAt(x, z), 0);
}

export function movementSpeedFactorAt(x, z) {
  return waterDepthAt(x, z) > WADING_DEPTH ? WADING_SPEED_FACTOR : 1;
}

function riverGroundHeight(x, z) {
  const land = landHeight(x, z);
  const distance = Math.abs(x - riverCenterX(z));
  const valleyReach = RIVER.halfWidth + RIVER.bankWidth + RIVER.valleyBlendWidth;
  if (distance >= valleyReach) return land;

  const valleyFloor = landHeight(riverCenterX(z), z);
  const bankRise = smoothstep(distance, RIVER.halfWidth, RIVER.halfWidth + RIVER.bankWidth);
  const riverShape = valleyFloor - RIVER.bedDepth + (RIVER.bedDepth + RIVER.bankTopHeight) * bankRise;
  const valley = 1 - smoothstep(distance, RIVER.halfWidth + RIVER.bankWidth, valleyReach);
  return land * (1 - valley) + riverShape * valley;
}

function bridgeDeckHeight(x, z) {
  if (x < BRIDGE.fromX || x > BRIDGE.toX || Math.abs(z - BRIDGE.z) > BRIDGE.halfWidth) return null;
  const along = (x - BRIDGE.fromX) / (BRIDGE.toX - BRIDGE.fromX);
  const startHeight = riverGroundHeight(BRIDGE.fromX, BRIDGE.z);
  const endHeight = riverGroundHeight(BRIDGE.toX, BRIDGE.z);
  return startHeight + (endHeight - startHeight) * along + BRIDGE.archHeight * Math.sin(Math.PI * along);
}

function landHeight(x, z) {
  const distanceFromSpawn = Math.hypot(x, z);
  const rolling = rollingHillsHeight(x, z) * smoothstep(distanceFromSpawn, MEADOW_RADIUS, ROLLING_HILLS_FULL_RADIUS);

  const distanceFromCamp = Math.hypot(x - BANDIT_CAMP.x, z - BANDIT_CAMP.z);
  const hilltop = 1 - smoothstep(distanceFromCamp, BANDIT_HILL.flatRadius, BANDIT_HILL.footRadius);
  const withHill = rolling * (1 - hilltop) + BANDIT_HILL.topHeight * hilltop;

  return withHill + mountainHeight(x, z);
}

function rollingHillsHeight(x, z) {
  return (
    2.2 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.038 - 0.7) +
    1.3 * Math.sin((x + z) * 0.07 + 2.1) +
    0.8 * Math.cos(x * 0.11 - z * 0.09)
  );
}

// The border is a rounded square, so the mountains follow all four edges of the map. The cave mouth cuts into them.
function mountainHeight(x, z) {
  const distanceToEdgeLine = Math.max(Math.abs(x), Math.abs(z));
  const rise = smoothstep(distanceToEdgeLine, MOUNTAINS.startDistance, MOUNTAINS.fullDistance);
  const ridges = MOUNTAINS.ridgeHeight * Math.sin(x * 0.08) * Math.cos(z * 0.07);
  const distanceToMouth = distanceToSegment(x, z, CAVE_MOUTH);
  const mouthWallTop = CAVE_MOUTH.halfWidth + CAVE_MOUTH.blendWidth;
  const mouthOpening = 1 - smoothstep(distanceToMouth, CAVE_MOUTH.halfWidth, mouthWallTop);
  return (rise ** 1.5 * MOUNTAINS.height + rise * ridges) * (1 - mouthOpening);
}

function distanceToSegment(x, z, { fromX, fromZ, toX, toZ }) {
  const lengthSquared = (toX - fromX) ** 2 + (toZ - fromZ) ** 2;
  const along = Math.min(Math.max(((x - fromX) * (toX - fromX) + (z - fromZ) * (toZ - fromZ)) / lengthSquared, 0), 1);
  return Math.hypot(x - (fromX + (toX - fromX) * along), z - (fromZ + (toZ - fromZ) * along));
}

function smoothstep(value, edgeFrom, edgeTo) {
  const t = Math.min(Math.max((value - edgeFrom) / (edgeTo - edgeFrom), 0), 1);
  return t * t * (3 - 2 * t);
}

// A map terrain gives the ground height, the speed factor, and the size of its square. Every map has one.
export const OVERWORLD_TERRAIN = { halfSize: WORLD_HALF_SIZE, groundHeightAt, movementSpeedFactorAt };
