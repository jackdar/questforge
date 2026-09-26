// Turns the triangles of a terrain mesh into a grid of ground heights. The server and the client both read the ground
// from this grid, so the ground that the player walks on is the ground that the artist modelled.
// A grid point that no triangle covers, for example at the very edge of the mesh, takes the lowest height of the map.
export function buildHeightGrid(triangleSets, cellSize) {
  const bounds = boundsOf(triangleSets);
  // The tolerance keeps the last grid point when float error puts the edge of the mesh just short of it.
  const columns = Math.floor((bounds.maxX - bounds.minX) / cellSize + 1e-3) + 1;
  const rows = Math.floor((bounds.maxZ - bounds.minZ) / cellSize + 1e-3) + 1;
  const heights = new Float32Array(columns * rows).fill(Number.NaN);

  for (const { positions, indices } of triangleSets) {
    for (let index = 0; index < indices.length; index += 3) {
      const corners = [indices[index], indices[index + 1], indices[index + 2]].map((vertex) => ({
        x: positions[vertex * 3],
        y: positions[vertex * 3 + 1],
        z: positions[vertex * 3 + 2],
      }));
      rasterizeTriangle(corners, { bounds, cellSize, columns, rows, heights });
    }
  }

  let coveredMinimum = Infinity;
  for (const height of heights) if (!Number.isNaN(height)) coveredMinimum = Math.min(coveredMinimum, height);
  for (let index = 0; index < heights.length; index++) if (Number.isNaN(heights[index])) heights[index] = coveredMinimum;

  return { originX: bounds.minX, originZ: bounds.minZ, cellSize, columns, rows, heights };
}

// Each grid point inside the triangle, seen from above, takes the height of the triangle at that point. Where two
// surfaces overlap, the higher one counts, so the ground is the top surface.
function rasterizeTriangle([a, b, c], { bounds, cellSize, columns, rows, heights }) {
  const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
  if (Math.abs(area) < 1e-12) return;

  const firstColumn = Math.max(Math.ceil((Math.min(a.x, b.x, c.x) - bounds.minX) / cellSize), 0);
  const lastColumn = Math.min(Math.floor((Math.max(a.x, b.x, c.x) - bounds.minX) / cellSize), columns - 1);
  const firstRow = Math.max(Math.ceil((Math.min(a.z, b.z, c.z) - bounds.minZ) / cellSize), 0);
  const lastRow = Math.min(Math.floor((Math.max(a.z, b.z, c.z) - bounds.minZ) / cellSize), rows - 1);

  for (let row = firstRow; row <= lastRow; row++) {
    const z = bounds.minZ + row * cellSize;
    for (let column = firstColumn; column <= lastColumn; column++) {
      const x = bounds.minX + column * cellSize;
      const weightA = ((b.x - x) * (c.z - z) - (c.x - x) * (b.z - z)) / area;
      const weightB = ((c.x - x) * (a.z - z) - (a.x - x) * (c.z - z)) / area;
      const weightC = 1 - weightA - weightB;
      const tolerance = -1e-9;
      if (weightA < tolerance || weightB < tolerance || weightC < tolerance) continue;

      const height = weightA * a.y + weightB * b.y + weightC * c.y;
      const cell = row * columns + column;
      if (Number.isNaN(heights[cell]) || height > heights[cell]) heights[cell] = height;
    }
  }
}

function boundsOf(triangleSets) {
  const bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const { positions } of triangleSets) {
    for (let index = 0; index < positions.length; index += 3) {
      bounds.minX = Math.min(bounds.minX, positions[index]);
      bounds.maxX = Math.max(bounds.maxX, positions[index]);
      bounds.minZ = Math.min(bounds.minZ, positions[index + 2]);
      bounds.maxZ = Math.max(bounds.maxZ, positions[index + 2]);
    }
  }
  return bounds;
}
