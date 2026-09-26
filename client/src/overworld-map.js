import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useOverworldHeightGrid } from 'questforge-shared/height-grid.js';

const TERRAIN_NODE_NAME = 'terrain';
const TREES_NODE_NAME = 'trees';

let mapModel = null;

// Loads the height grid and the model of the Blender map. The game calls this once, before it shows the overworld.
export async function loadOverworldMap({ grid, heightFileUrl, modelUrl }) {
  const [heightBytes, gltf] = await Promise.all([
    fetchBytes(heightFileUrl),
    new GLTFLoader().loadAsync(modelUrl),
  ]);
  useOverworldHeightGrid({ ...grid, heights: new Float32Array(heightBytes) });
  mapModel = new THREE.Group();
  mapModel.add(prepareTerrainModel(gltf.scene));
  const trees = gltf.scene.getObjectByName(TREES_NODE_NAME);
  if (trees) mapModel.add(prepareTrees(trees));
}

// Returns a new copy of the map model each time, because the game frees the scenery when the player leaves the
// map. The copies share the geometry, and three.js sends it to the GPU again when it shows it again.
export function createBlenderMap() {
  return mapModel?.clone() ?? null;
}

// The map has trees when the Blender file scatters them on an object named "trees".
export function hasBlenderTrees() {
  return Boolean(mapModel?.getObjectByName(TREES_NODE_NAME));
}

async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the overworld height grid from ${url}: HTTP ${response.status}.`);
  return response.arrayBuffer();
}

// Blender can export the ground colours as the second colour set, which three.js does not show. The ground then
// uses whichever colour set the export has.
function prepareTerrainModel(gltfScene) {
  const terrain = gltfScene.getObjectByName(TERRAIN_NODE_NAME);
  if (!terrain) throw new Error(`The overworld map has no object named "${TERRAIN_NODE_NAME}".`);
  terrain.traverse((object) => {
    if (!object.isMesh) return;
    const colorName = Object.keys(object.geometry.attributes).find((name) => name.startsWith('color'));
    if (colorName && colorName !== 'color') object.geometry.setAttribute('color', object.geometry.getAttribute(colorName));
    object.material.vertexColors = Boolean(colorName);
    object.receiveShadow = true;
  });
  return terrain;
}

function prepareTrees(trees) {
  trees.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return trees;
}
