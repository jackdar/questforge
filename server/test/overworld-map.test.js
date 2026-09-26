import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { OVERWORLD_TERRAIN } from 'questforge-shared/terrain.js';
import { loadOverworldHeightGrid } from '../src/overworld-map.js';

test('without a built height grid the overworld keeps its calculated terrain', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'questforge-map-'));
  context.after(() => rm(directory, { recursive: true }));
  const calculatedGroundHeightAt = OVERWORLD_TERRAIN.groundHeightAt;

  const usesBlenderMap = await loadOverworldHeightGrid(pathToFileURL(`${directory}/`));

  assert.equal(usesBlenderMap, false);
  assert.equal(OVERWORLD_TERRAIN.groundHeightAt, calculatedGroundHeightAt);
});

test('a built height grid becomes the ground of the overworld', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'questforge-map-'));
  context.after(() => rm(directory, { recursive: true }));
  const grid = { originX: 0, originZ: 0, cellSize: 400, columns: 2, rows: 2, seaLevel: 0 };
  await writeFile(join(directory, 'overworld-heights.json'), JSON.stringify(grid));
  await writeFile(join(directory, 'overworld-heights.bin'), new Uint8Array(new Float32Array([1, 3, 1, 3]).buffer));

  const usesBlenderMap = await loadOverworldHeightGrid(pathToFileURL(`${directory}/`));

  assert.equal(usesBlenderMap, true);
  assert.equal(OVERWORLD_TERRAIN.groundHeightAt(200, 200), 2);
});
