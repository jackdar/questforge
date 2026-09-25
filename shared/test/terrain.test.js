import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANDIT_CAMP, STARTING_CAMP } from '../places.js';
import {
  BRIDGE,
  groundHeightAt,
  MAX_WALKABLE_SLOPE,
  movementSpeedFactorAt,
  RIVER,
  riverCenterX,
  waterDepthAt,
  waterLevelAt,
  WORLD_HALF_SIZE,
} from '../terrain.js';

const SAMPLE_STEP = 0.25;

function steepestSlopeAlong(fromX, fromZ, toX, toZ) {
  const length = Math.hypot(toX - fromX, toZ - fromZ);
  let steepest = 0;
  for (let travelled = 0; travelled < length; travelled += SAMPLE_STEP) {
    const t = travelled / length;
    const x = fromX + (toX - fromX) * t;
    const z = fromZ + (toZ - fromZ) * t;
    const dx = ((toX - fromX) / length) * SAMPLE_STEP;
    const dz = ((toZ - fromZ) / length) * SAMPLE_STEP;
    steepest = Math.max(steepest, Math.abs(groundHeightAt(x + dx, z + dz) - groundHeightAt(x, z)) / SAMPLE_STEP);
  }
  return steepest;
}

test('the meadow around the player spawn and the starting camp is flat', () => {
  for (const [x, z] of [
    [0, 0],
    [STARTING_CAMP.x, STARTING_CAMP.z],
    [-5, 3],
    [20, -20],
  ]) {
    assert.equal(groundHeightAt(x, z), 0, `${x}, ${z}`);
  }
});

test('the bandit camp stands on a flat hilltop above the land around it', () => {
  const campHeight = groundHeightAt(BANDIT_CAMP.x, BANDIT_CAMP.z);

  assert.ok(campHeight >= 6);
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.5) {
    const edgeX = BANDIT_CAMP.x + Math.cos(angle) * BANDIT_CAMP.radius;
    const edgeZ = BANDIT_CAMP.z + Math.sin(angle) * BANDIT_CAMP.radius;
    assert.equal(groundHeightAt(edgeX, edgeZ), campHeight);
  }
});

test('a player can walk up the bandit hill from every side', () => {
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.3) {
    const footX = BANDIT_CAMP.x + Math.cos(angle) * 50;
    const footZ = BANDIT_CAMP.z + Math.sin(angle) * 50;
    assert.ok(steepestSlopeAlong(footX, footZ, BANDIT_CAMP.x, BANDIT_CAMP.z) <= MAX_WALKABLE_SLOPE, `angle ${angle}`);
  }
});

test('the mountains at the edge of the map rise high, and a player cannot walk up their steepest faces', () => {
  for (const [x, z] of [
    [WORLD_HALF_SIZE, 0],
    [0, -WORLD_HALF_SIZE],
    [-WORLD_HALF_SIZE, WORLD_HALF_SIZE],
  ]) {
    assert.ok(groundHeightAt(x, z) > 20, `${x}, ${z}`);
    assert.ok(steepestSlopeAlong(x * 0.75, z * 0.75, x, z) > MAX_WALKABLE_SLOPE, `${x}, ${z}`);
  }
});

// Cliffs, such as the walls of the cave mouth, are steep but smooth. A break would jump even over a tiny step.
test('the land has no breaks, only smooth slopes', () => {
  for (let x = -WORLD_HALF_SIZE; x < WORLD_HALF_SIZE; x += 3) {
    for (let z = -WORLD_HALF_SIZE; z < WORLD_HALF_SIZE; z += 3) {
      assert.ok(Math.abs(groundHeightAt(x + 0.01, z) - groundHeightAt(x, z)) < 0.1, `${x}, ${z}`);
    }
  }
});

test('the river is about a waist deep in the middle all along its course, and the banks hold the water', () => {
  for (let z = -120; z <= 120; z += 5) {
    const centerX = riverCenterX(z);
    const depth = waterDepthAt(centerX, z);
    if (Math.abs(z - BRIDGE.z) <= BRIDGE.halfWidth) continue;
    assert.ok(depth > 0.8 && depth < 1.2, `z ${z}: depth ${depth}`);
    const bankTopDistance = RIVER.halfWidth + RIVER.bankWidth;
    assert.ok(groundHeightAt(centerX - bankTopDistance, z) > waterLevelAt(z), `z ${z}: west bank`);
    assert.ok(groundHeightAt(centerX + bankTopDistance, z) > waterLevelAt(z), `z ${z}: east bank`);
  }
});

test('a player wades through the river at half speed and walks at full speed on dry land', () => {
  assert.equal(movementSpeedFactorAt(riverCenterX(40), 40), 0.5);
  assert.equal(movementSpeedFactorAt(0, 0), 1);
});

test('the bridge deck stands above the water, has no water on it, and its ends meet the banks', () => {
  const middleX = riverCenterX(BRIDGE.z);

  assert.ok(groundHeightAt(middleX, BRIDGE.z) > waterLevelAt(BRIDGE.z) + 1);
  assert.equal(waterDepthAt(middleX, BRIDGE.z), 0);
  assert.equal(movementSpeedFactorAt(middleX, BRIDGE.z), 1);
  assert.ok(steepestSlopeAlong(BRIDGE.fromX - 5, BRIDGE.z, BRIDGE.toX + 5, BRIDGE.z) <= MAX_WALKABLE_SLOPE);
});

// East of the river, the mountains begin soon after the bank, so the check ends where the river valley ends.
test('a player can climb out of the river on either bank', () => {
  const bankReach = RIVER.halfWidth + RIVER.bankWidth + 6;
  for (let z = -110; z <= 110; z += 10) {
    const centerX = riverCenterX(z);
    assert.ok(steepestSlopeAlong(centerX, z, centerX - bankReach, z) <= MAX_WALKABLE_SLOPE, `z ${z}: west`);
    assert.ok(steepestSlopeAlong(centerX, z, centerX + bankReach, z) <= MAX_WALKABLE_SLOPE, `z ${z}: east`);
  }
});
