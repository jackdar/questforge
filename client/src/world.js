import * as THREE from 'three';
import { BANDIT_CAMP, STARTING_CAMP } from 'questforge-shared/places.js';
import { groundHeightAt, RIVER, riverCenterX } from 'questforge-shared/terrain.js';
import { createTerrainMesh } from './terrain-mesh.js';
import { createBridge, createRiverWater } from './river.js';
import { createBanditCamp } from './bandit-camp.js';
import { createStartingCamp } from './starting-camp.js';
import { applySky, SHADOW_AREA_SIZE, SHADOW_MAP_SIZE } from './day-night.js';
import { PORTALS } from 'questforge-shared/maps.js';
import { createPortal, createPortalArch } from './portal.js';


const TREE_COUNT = 60;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// The overworld scenery is one group, so that the game can take it out of the scene when the player enters
// another map. The update moves the parts that change over time: the light of the day, the camps, and the portals.
export function createOverworldScenery(scene) {
  scene.background = new THREE.Color(0x87b8e0);
  scene.fog = new THREE.Fog(0x87b8e0, 60, 180);
  const root = new THREE.Group();

  const ambient = new THREE.HemisphereLight(0xdfefff, 0x4a5a30, 1.2);
  const celestialLight = createCelestialLight();
  const sunDisc = createSkyDisc(0xfff2c0, 9);
  const moonDisc = createSkyDisc(0xe8ecff, 6);
  // The light aims at its target, and the target must be in the scene for the light to follow it.
  root.add(ambient, celestialLight, celestialLight.target, sunDisc, moonDisc, createTerrainMesh());
  root.add(createRiverWater(), createBridge());

  for (const position of treePositions()) root.add(createTree(position));

  const camps = [createBanditCamp(), createStartingCamp()];
  for (const camp of camps) root.add(camp.group);

  const portals = PORTALS.filter((portal) => portal.mapId === 'overworld').map((place) => {
    root.add(createPortalArch(place, groundHeightAt));
    return createPortal(place, groundHeightAt);
  });
  for (const portal of portals) root.add(portal.object);
  scene.add(root);

  function update(time, dayFraction, { cameraPosition, playerPosition }) {
    const lighting = { scene, celestialLight, ambient, sunDisc, moonDisc, cameraPosition, playerPosition };
    const daylight = applySky(dayFraction, lighting);
    for (const camp of camps) camp.update(time, daylight);
    for (const portal of portals) portal.update(time);
  }

  return { root, update };
}

// No tree grows inside a camp or in the river and on its banks, so that those places have open ground.
const RIVER_CLEAR_DISTANCE = RIVER.halfWidth + RIVER.bankWidth + 2;

export function treePositions() {
  return Array.from({ length: TREE_COUNT }, (_, index) => treePosition(index)).filter(
    (position) => !isInsideACamp(position) && Math.abs(position.x - riverCenterX(position.z)) > RIVER_CLEAR_DISTANCE,
  );
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
  Object.assign(light.shadow.camera, { left: -halfArea, right: halfArea, top: halfArea, bottom: -halfArea });
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
  return new THREE.Vector3(x, groundHeightAt(x, z), z);
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
