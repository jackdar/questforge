import * as THREE from 'three';
import { BANDIT_CAMP, STARTING_CAMP } from 'questforge-shared/places.js';
import { OVERWORLD_TERRAIN, RIVER, riverCenterX, VIEW_DISTANCE } from 'questforge-shared/terrain.js';
import { createTerrainMesh } from './terrain-mesh.js';
import { createBridge, createRiverWater } from './river.js';
import { createBanditCamp } from './bandit-camp.js';
import { createStartingCamp } from './starting-camp.js';
import { applySky, SHADOW_AREA_SIZE, SHADOW_CAMERA_FAR, SHADOW_MAP_SIZE } from './day-night.js';
import { PORTALS } from 'questforge-shared/maps.js';
import { createPortal, createPortalArch } from './portal.js';
import { createBlenderMap, hasBlenderTrees } from './overworld-map.js';


const TREE_COUNT = 60;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// The overworld scenery is one group, so that the game can take it out of the scene when the player enters
// another map. The update moves the parts that change over time: the light of the day, the camps, and the portals.
export function createOverworldScenery(scene) {
  scene.background = new THREE.Color(0x87b8e0);
  scene.fog = new THREE.Fog(0x87b8e0, 60, VIEW_DISTANCE);
  const root = new THREE.Group();

  const ambient = new THREE.HemisphereLight(0xdfefff, 0x4a5a30, 1.2);
  const celestialLight = createCelestialLight();
  const sunDisc = createSkyDisc(0xfff2c0, 9);
  const moonDisc = createSkyDisc(0xe8ecff, 6);
  // The light aims at its target, and the target must be in the scene for the light to follow it.
  root.add(ambient, celestialLight, celestialLight.target, sunDisc, moonDisc);
  const blenderMap = createBlenderMap();
  if (blenderMap) {
    root.add(blenderMap, createSea(OVERWORLD_TERRAIN));
  } else {
    root.add(createTerrainMesh(), createRiverWater(), createBridge());
  }

  // The trees of a Blender map come with the map. Without them, the game grows its own.
  if (!hasBlenderTrees()) {
    for (const position of treePositions()) root.add(createTree(position));
  }

  const camps = [createBanditCamp(), createStartingCamp()];
  for (const camp of camps) root.add(camp.group);

  const portals = PORTALS.filter((portal) => portal.mapId === 'overworld').map((place) => {
    root.add(createPortalArch(place, OVERWORLD_TERRAIN.groundHeightAt));
    return createPortal(place, OVERWORLD_TERRAIN.groundHeightAt);
  });
  for (const portal of portals) root.add(portal.object);
  scene.add(root);

  function update(time, dayFraction, { cameraPosition, playerPosition }) {
    const lighting = { scene, celestialLight, ambient, sunDisc, moonDisc, cameraPosition, playerPosition };
    const daylight = applySky(dayFraction, lighting);
    for (const camp of camps) camp.update(time, daylight);
    for (const portal of portals) portal.update(time, cameraPosition, scene.fog);
  }

  return { root, update };
}

// No tree grows inside a camp, in the river and on its banks, or in water, so that those places have open ground.
const RIVER_CLEAR_DISTANCE = RIVER.halfWidth + RIVER.bankWidth + 2;

export function treePositions() {
  return Array.from({ length: TREE_COUNT }, (_, index) => treePosition(index)).filter(
    (position) =>
      !isInsideACamp(position) &&
      Math.abs(position.x - riverCenterX(position.z)) > RIVER_CLEAR_DISTANCE &&
      OVERWORLD_TERRAIN.waterDepthAt(position.x, position.z) === 0,
  );
}

// The sea reaches far past the edge of the map, so the fog hides where it ends.
const SEA_MARGIN = 1000;

function createSea({ bounds, seaLevel }) {
  const width = bounds.maxX - bounds.minX + SEA_MARGIN * 2;
  const depth = bounds.maxZ - bounds.minZ + SEA_MARGIN * 2;
  const material = new THREE.MeshStandardMaterial({ color: 0x2f6f9f, transparent: true, opacity: 0.75, roughness: 0.3 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set((bounds.minX + bounds.maxX) / 2, seaLevel, (bounds.minZ + bounds.maxZ) / 2);
  return sea;
}

function isInsideACamp({ x, z }) {
  return [BANDIT_CAMP, STARTING_CAMP].some((camp) => Math.hypot(x - camp.x, z - camp.z) <= camp.radius);
}

// The sun by day and the moon by night. The day and night cycle moves it and sets its colour.
function createCelestialLight() {
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(30, 50, 20);
  light.castShadow = true;
  light.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  const halfArea = SHADOW_AREA_SIZE / 2;
  Object.assign(light.shadow.camera, {
    left: -halfArea,
    right: halfArea,
    top: halfArea,
    bottom: -halfArea,
    far: SHADOW_CAMERA_FAR,
  });
  return light;
}

// The fog must not hide the sun or the moon, which stand far beyond the fog distance.
function createSkyDisc(color, radius) {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, fog: false });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material);
}

// Every client must place the trees in the same spots, so this uses a spiral instead of Math.random.
function treePosition(index) {
  const angle = index * GOLDEN_ANGLE;
  const radius = 12 + ((index * 37) % 80);
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  return new THREE.Vector3(x, OVERWORLD_TERRAIN.groundHeightAt(x, z), z);
}

function createTree(position) {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 2),
    new THREE.MeshStandardMaterial({ color: 0x6b4423 }),
  );
  trunk.position.y = 1;

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(1.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f6b2f }),
  );
  leaves.position.y = 4;

  for (const part of [trunk, leaves]) {
    part.castShadow = true;
    tree.add(part);
  }

  tree.position.copy(position);
  return tree;
}
