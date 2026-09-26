import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraLookPoint, clearCameraDistance, nextShownDistance } from '../src/camera.js';

const flatGround = { groundHeightAt: () => 0 };
// A wall of rock rises from x = 5 on.
const wallAtFive = { groundHeightAt: (x) => (x >= 5 ? 20 : 0) };
const lowCeiling = { groundHeightAt: () => 0, ceilingHeight: 6 };
const pivot = new THREE.Vector3(0, 2, 0);
const backAlongX = new THREE.Vector3(1, 0, 0);
const upAndBack = new THREE.Vector3(1, 1, 0).normalize();

test('the camera goes to its full distance when nothing is in the way', () => {
  assert.equal(clearCameraDistance(pivot, backAlongX, 10, flatGround), 10);
});

test('the camera comes closer and stops before a wall behind the player', () => {
  const distance = clearCameraDistance(pivot, backAlongX, 10, wallAtFive);

  assert.ok(distance < 5);
  assert.ok(distance > 4);
});

test('the camera comes closer and stops below a ceiling', () => {
  const distance = clearCameraDistance(pivot, upAndBack, 10, lowCeiling);
  const cameraHeight = pivot.y + upAndBack.y * distance;

  assert.ok(distance < 10);
  assert.ok(cameraHeight < lowCeiling.ceilingHeight);
});

test('the camera keeps a small distance even with a wall right behind the player', () => {
  const wallAtOnce = { groundHeightAt: () => 20 };

  assert.ok(clearCameraDistance(pivot, backAlongX, 10, wallAtOnce) > 0);
});

test('a camera pushed in by a wall looks in the same direction as at its full distance', () => {
  const fullPosition = pivot.clone().addScaledVector(upAndBack, 10);
  const pushedPosition = pivot.clone().addScaledVector(upAndBack, 0.6);

  const fullView = cameraLookPoint(pivot, upAndBack, 10, 10).sub(fullPosition).normalize();
  const pushedView = cameraLookPoint(pivot, upAndBack, 10, 0.6).sub(pushedPosition).normalize();

  assert.ok(fullView.distanceTo(pushedView) < 1e-9);
});

test('the camera jumps in to a wall at once', () => {
  assert.equal(nextShownDistance(10, 2, 0.016), 2);
});

test('the camera glides back out after the wall stops blocking it', () => {
  const nextDistance = nextShownDistance(2, 10, 0.016);

  assert.ok(nextDistance > 2);
  assert.ok(nextDistance < 10);
});
