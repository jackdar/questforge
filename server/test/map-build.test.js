import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findNodeInWorld, parseGlb, readMeshTrianglesInWorld } from '../src/map-build/glb.js';
import { buildHeightGrid } from '../src/map-build/height-grid.js';

// A square from -1 to 1 on x and z, made of two triangles. Its height rises from 0 on the left to 2 on the right.
const SLOPED_SQUARE = {
  positions: [-1, 0, -1, 1, 2, -1, 1, 2, 1, -1, 0, 1],
  indices: [0, 1, 2, 0, 2, 3],
};

test('the height grid follows the height of the triangles at each grid point', () => {
  const grid = buildHeightGrid([SLOPED_SQUARE], 1);

  assert.deepEqual([grid.originX, grid.originZ, grid.columns, grid.rows], [-1, -1, 3, 3]);
  assert.deepEqual([...grid.heights], [0, 1, 2, 0, 1, 2, 0, 1, 2]);
});

test('where two surfaces overlap, the grid takes the higher one', () => {
  const flatAboveSlope = { positions: [-1, 5, -1, 1, 5, -1, 1, 5, 1], indices: [0, 1, 2] };

  const grid = buildHeightGrid([SLOPED_SQUARE, flatAboveSlope], 1);

  assert.equal(grid.heights[2], 5);
  assert.equal(grid.heights[6], 0);
});

test('grid points that no triangle covers take the lowest height of the map', () => {
  const halfSquare = { positions: [-1, 3, -1, 1, 4, -1, 1, 4, 1], indices: [0, 1, 2] };

  const grid = buildHeightGrid([halfSquare], 1);

  assert.equal(grid.heights[6], 3);
});

test('the map build reads the mesh of a named node with the scale of the node', () => {
  const positions = new Float32Array([0, 0, 0, 1, 1, 0, 0, 0, 1]);
  const indices = new Uint16Array([0, 1, 2]);
  const binary = new Uint8Array(new ArrayBuffer(44));
  binary.set(new Uint8Array(positions.buffer), 0);
  binary.set(new Uint8Array(indices.buffer), 36);
  const json = {
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'terrain', mesh: 0, scale: [2, 3, 4], translation: [10, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ byteLength: 44 }],
  };
  // The JSON chunk must fill a multiple of four bytes, so spaces pad it.
  const jsonText = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonText.padEnd(Math.ceil(jsonText.length / 4) * 4, ' '));
  const file = new Uint8Array(12 + 8 + jsonBytes.length + 8 + binary.length);
  const view = new DataView(file.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, file.length, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  file.set(jsonBytes, 20);
  view.setUint32(20 + jsonBytes.length, binary.length, true);
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  file.set(binary, 28 + jsonBytes.length);

  const glb = parseGlb(file);
  const { node, worldMatrix } = findNodeInWorld(glb, 'terrain');
  const [triangles] = readMeshTrianglesInWorld(glb, glb.json.meshes[node.mesh], worldMatrix);

  assert.deepEqual([...triangles.positions], [10, 0, 0, 12, 3, 0, 10, 0, 4]);
  assert.deepEqual(triangles.indices, [0, 1, 2]);
});

test('a file that is not a binary glTF is refused', () => {
  assert.throws(() => parseGlb(new Uint8Array(16)), /not a binary glTF/);
});
