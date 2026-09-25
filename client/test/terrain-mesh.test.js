import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groundHeightAt, WORLD_HALF_SIZE } from 'questforge-shared/terrain.js';
import { BANDIT_CAMP } from 'questforge-shared/places.js';
import { createTerrainMesh, groundColorAt } from '../src/terrain-mesh.js';

test('every vertex of the ground mesh stands at the shared ground height', () => {
  const positions = createTerrainMesh().geometry.attributes.position;

  for (let index = 0; index < positions.count; index += 97) {
    const expected = groundHeightAt(positions.getX(index), positions.getZ(index));
    assert.ok(Math.abs(positions.getY(index) - expected) < 1e-4);
  }
});

test('the ground mesh covers the whole map', () => {
  const { geometry } = createTerrainMesh();
  geometry.computeBoundingBox();

  assert.equal(geometry.boundingBox.min.x, -WORLD_HALF_SIZE);
  assert.equal(geometry.boundingBox.max.z, WORLD_HALF_SIZE);
});

test('flat ground is green, and the mountain peaks are snowy', () => {
  const meadow = groundColorAt(0, 0, groundHeightAt(0, 0));
  const peakHeight = groundHeightAt(WORLD_HALF_SIZE, WORLD_HALF_SIZE);
  const peak = groundColorAt(WORLD_HALF_SIZE, WORLD_HALF_SIZE, peakHeight);

  assert.ok(meadow.g > meadow.r && meadow.g > meadow.b);
  assert.ok(peak.r > 0.8 && peak.g > 0.8 && peak.b > 0.8);
});

test('the flat top of the bandit hill is grass, not rock', () => {
  const color = groundColorAt(BANDIT_CAMP.x, BANDIT_CAMP.z, groundHeightAt(BANDIT_CAMP.x, BANDIT_CAMP.z));

  assert.ok(color.g > color.r);
});
