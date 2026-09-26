import { OVERWORLD_TERRAIN, WADING_DEPTH, WADING_SPEED_FACTOR } from './terrain.js';

// An invisible wall stops the players this far inside the edge of the grid. The sea reaches far past the edge, so
// the players do not see where the grid ends.
export const EDGE_WALL_INSET = 120;

// A map terrain made from a height grid that the map build bakes from a Blender model. The grid has one height every
// cellSize units, from the corner at originX, originZ. Between the grid points, the height changes in a straight
// line on each axis, so the ground is smooth. Outside the grid, the ground keeps the height of the nearest edge.
// The sea covers all ground below the sea level.
export function createHeightGridTerrain({ originX, originZ, cellSize, columns, rows, heights, seaLevel }) {
  if (heights.length !== columns * rows) {
    const needed = columns * rows;
    throw new Error(`The height grid has ${heights.length} heights, but a ${columns} × ${rows} grid needs ${needed}.`);
  }
  const maxX = originX + (columns - 1) * cellSize;
  const maxZ = originZ + (rows - 1) * cellSize;

  function groundHeightAt(x, z) {
    const column = (Math.min(Math.max(x, originX), maxX) - originX) / cellSize;
    const row = (Math.min(Math.max(z, originZ), maxZ) - originZ) / cellSize;
    const column0 = Math.min(Math.floor(column), columns - 2);
    const row0 = Math.min(Math.floor(row), rows - 2);
    const alongColumn = column - column0;
    const alongRow = row - row0;
    const heightAt = (gridColumn, gridRow) => heights[gridRow * columns + gridColumn];
    const near = heightAt(column0, row0) * (1 - alongColumn) + heightAt(column0 + 1, row0) * alongColumn;
    const far = heightAt(column0, row0 + 1) * (1 - alongColumn) + heightAt(column0 + 1, row0 + 1) * alongColumn;
    return near * (1 - alongRow) + far * alongRow;
  }

  function waterDepthAt(x, z) {
    return Math.max(seaLevel - groundHeightAt(x, z), 0);
  }

  function movementSpeedFactorAt(x, z) {
    return waterDepthAt(x, z) > WADING_DEPTH ? WADING_SPEED_FACTOR : 1;
  }

  const bounds = {
    minX: originX + EDGE_WALL_INSET,
    maxX: maxX - EDGE_WALL_INSET,
    minZ: originZ + EDGE_WALL_INSET,
    maxZ: maxZ - EDGE_WALL_INSET,
  };
  if (bounds.minX > bounds.maxX || bounds.minZ > bounds.maxZ) {
    throw new Error(`The height grid must be more than ${EDGE_WALL_INSET * 2} units wide and deep.`);
  }
  return { bounds, seaLevel, groundHeightAt, waterDepthAt, movementSpeedFactorAt };
}

// The server and the client call this at start when the map build has made a height grid for the overworld. Every
// part of the game that reads the overworld terrain then reads the Blender map.
export function useOverworldHeightGrid(heightGrid) {
  delete OVERWORLD_TERRAIN.halfSize;
  Object.assign(OVERWORLD_TERRAIN, createHeightGridTerrain(heightGrid));
}
