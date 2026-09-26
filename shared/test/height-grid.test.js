import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standingHeightAt, SWIM_DEPTH, WADING_SPEED_FACTOR } from '../terrain.js';
import { createHeightGridTerrain, EDGE_WALL_INSET } from '../height-grid.js';

// Three columns and three rows, 200 units apart, from the corner at -200, -200. The sea stands at height 0.
const GRID = {
  originX: -200,
  originZ: -200,
  cellSize: 200,
  columns: 3,
  rows: 3,
  heights: new Float32Array([-4, 0, 2, -4, 4, 6, -4, 4, 6]),
  seaLevel: 0,
};

test('the ground has the grid height at each grid point', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(terrain.groundHeightAt(-200, -200), -4);
  assert.equal(terrain.groundHeightAt(200, -200), 2);
  assert.equal(terrain.groundHeightAt(0, 0), 4);
});

test('the ground between grid points blends the heights around it', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(terrain.groundHeightAt(100, -200), 1);
  assert.equal(terrain.groundHeightAt(100, -100), (0 + 2 + 4 + 6) / 4);
});

test('the ground outside the grid keeps the height of the nearest edge', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(terrain.groundHeightAt(5000, 0), 6);
  assert.equal(terrain.groundHeightAt(-5000, -5000), -4);
});

test('ground below the sea level is under water as deep as the gap', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(terrain.waterDepthAt(-200, -200), 4);
  assert.equal(terrain.waterDepthAt(200, 0), 0);
});

test('players wade slowly through water and walk at full speed on dry land', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(terrain.movementSpeedFactorAt(-200, -200), WADING_SPEED_FACTOR);
  assert.equal(terrain.movementSpeedFactorAt(200, 0), 1);
});

test('a player in deep water swims near the surface and a player on land stands on the ground', () => {
  const terrain = createHeightGridTerrain(GRID);

  assert.equal(standingHeightAt(terrain, -200, -200), -SWIM_DEPTH);
  assert.equal(standingHeightAt(terrain, 0, 0), 4);
});

test('the edge wall stands inside the edge of the grid', () => {
  const { bounds } = createHeightGridTerrain(GRID);

  assert.deepEqual(bounds, {
    minX: -200 + EDGE_WALL_INSET,
    maxX: 200 - EDGE_WALL_INSET,
    minZ: -200 + EDGE_WALL_INSET,
    maxZ: 200 - EDGE_WALL_INSET,
  });
});

test('a grid too small to leave room inside the edge wall is refused', () => {
  assert.throws(() => createHeightGridTerrain({ ...GRID, cellSize: 2 }), /more than/);
});

test('a grid with the wrong number of heights is refused', () => {
  assert.throws(() => createHeightGridTerrain({ ...GRID, heights: new Float32Array(5) }), /5 heights/);
});
