// Bakes the height grid of the overworld from the Blender export, so the server and the client know the height of
// the ground everywhere. Run it after each export: npm run build:map
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { findNodeInWorld, parseGlb, readMeshTrianglesInWorld } from '../src/map-build/glb.js';
import { buildHeightGrid } from '../src/map-build/height-grid.js';

const MAP_FILE = new URL('../../assets/maps/map_01_overworld.glb', import.meta.url);
const OUTPUT_DIRECTORY = new URL('../../shared/maps/', import.meta.url);
const TERRAIN_NODE_NAME = 'terrain';
const TREES_NODE_NAME = 'trees';
// Smaller cells follow the model more closely, but make a larger file for the server and the client.
const CELL_SIZE = 2;
const SEA_LEVEL = 0;

const glb = parseGlb(await readFile(MAP_FILE));
const terrainNode = findNodeInWorld(glb, TERRAIN_NODE_NAME);
if (terrainNode?.node.mesh === undefined) {
  throw new Error(
    `The map has no mesh object named "${TERRAIN_NODE_NAME}". Make sure that the export includes the ground object ` +
      `and that its name is "${TERRAIN_NODE_NAME}".`,
  );
}
const triangles = readMeshTrianglesInWorld(glb, glb.json.meshes[terrainNode.node.mesh], terrainNode.worldMatrix);
const { heights, ...grid } = buildHeightGrid(triangles, CELL_SIZE);

await mkdir(OUTPUT_DIRECTORY, { recursive: true });
await writeFile(new URL('overworld-heights.json', OUTPUT_DIRECTORY), `${JSON.stringify({ ...grid, seaLevel: SEA_LEVEL })}\n`);
// The heights are 32-bit floats in little-endian order, which is the byte order of the machines that run the game.
await writeFile(new URL('overworld-heights.bin', OUTPUT_DIRECTORY), new Uint8Array(heights.buffer));

const width = (grid.columns - 1) * CELL_SIZE;
const depth = (grid.rows - 1) * CELL_SIZE;
console.log(`Built the overworld height grid: ${width} × ${depth} units, ${grid.columns} × ${grid.rows} points.`);

// The game draws the trees from the map file, but only when the export includes them.
const treesNode = findNodeInWorld(glb, TREES_NODE_NAME);
if (treesNode) {
  console.log(`The map has ${countInstances(glb, treesNode.node)} trees.`);
} else {
  console.warn(`The map has no object named "${TREES_NODE_NAME}", so the game grows its own trees.`);
}

// A node with GPU instancing draws its mesh once for each instance. Other nodes count once for each mesh.
function countInstances({ json }, node) {
  const instancing = node.extensions?.EXT_mesh_gpu_instancing;
  const own = instancing ? json.accessors[instancing.attributes.TRANSLATION].count : node.mesh === undefined ? 0 : 1;
  const children = (node.children ?? []).map((index) => countInstances({ json }, json.nodes[index]));
  return children.reduce((total, count) => total + count, own);
}
