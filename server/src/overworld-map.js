import { readFile } from 'node:fs/promises';
import { useOverworldHeightGrid } from 'questforge-shared/height-grid.js';

const HEIGHT_GRID_DIRECTORY = new URL('../../shared/maps/', import.meta.url);

// Uses the height grid of the Blender map for the overworld when the map build has made one. Without it, the
// overworld keeps the terrain that shared/terrain.js calculates. Returns true when the Blender map is in use.
export async function loadOverworldHeightGrid(directory = HEIGHT_GRID_DIRECTORY) {
  let grid;
  let heightBytes;
  try {
    grid = JSON.parse(await readFile(new URL('overworld-heights.json', directory), 'utf8'));
    heightBytes = await readFile(new URL('overworld-heights.bin', directory));
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  // The copy puts the heights at the start of their own buffer, which a Float32Array needs.
  const heights = new Float32Array(new Uint8Array(heightBytes).buffer);
  useOverworldHeightGrid({ ...grid, heights });
  return true;
}
