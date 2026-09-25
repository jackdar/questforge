import * as THREE from 'three';
import { BOSS_CHAMBER, CAVE_CEILING_HEIGHT, CAVE_TERRAIN } from 'questforge-shared/cave-terrain.js';
import { PORTALS } from 'questforge-shared/maps.js';
import { createTerrainMesh } from './terrain-mesh.js';
import { createTorch } from './camp-props.js';
import { createPortal } from './portal.js';

const FLOOR = new THREE.Color(0x3a332c);
const WALL = new THREE.Color(0x4d4640);
const WALL_HEIGHT_FROM = 0.4;
const CEILING = 0x221e1b;
const NIGHT = 0;
const CRYSTAL_LIGHT_INTENSITY = 6;
// Glowing crystals grow along the walls and light the path through the cave, with two torches at the entrance.
// The lair of the Broodmother has the most crystals, and its walls are hung with webs.
const CRYSTAL_PLACES = [
  { x: -23, z: -16, color: 0x9a6aff },
  { x: -6, z: -8, color: 0x5ad0ff },
  { x: 8, z: 2, color: 0x5ad0ff },
  { x: 27, z: 18, color: 0x9a6aff },
  { x: 12, z: 26, color: 0x5ad0ff },
  { x: -22, z: 50, color: 0x9a6aff },
  { x: 6, z: 50, color: 0x9a6aff },
  { x: -8, z: 64, color: 0xc04aff },
];
const TORCH_PLACES = [
  { x: -4, z: -44 },
  { x: 4, z: -44 },
];
const WEB_PLACES = [
  { x: 3, z: 60, radius: 2.6 },
  { x: -19, z: 60, radius: 3.2 },
  { x: -21, z: 42, radius: 2.4 },
];
const WEB_RINGS = 5;
const WEB_SPOKES = 10;

// The cave is dark and enclosed: its ground rises into walls, and a low rock ceiling covers the whole hall.
export function createCaveScenery(scene) {
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 20, 80);
  const root = new THREE.Group();
  const { groundHeightAt, halfSize } = CAVE_TERRAIN;

  // The cave is dark but readable: the ambient light shows the walls, and the crystals and torches light the path.
  root.add(new THREE.HemisphereLight(0x6a5a8a, 0x201a14, 0.8));
  root.add(createTerrainMesh({ terrain: CAVE_TERRAIN, colorAt: caveColorAt, vertexSpacing: 1 }));

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(halfSize * 2, halfSize * 2),
    new THREE.MeshStandardMaterial({ color: CEILING, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CAVE_CEILING_HEIGHT;
  root.add(ceiling);

  for (const place of CRYSTAL_PLACES) root.add(createCrystalCluster(place, groundHeightAt));
  for (const place of WEB_PLACES) root.add(createWeb(place, groundHeightAt));
  const torches = TORCH_PLACES.map((place, index) => createTorch(place, index * 1.7));
  for (const torch of torches) root.add(torch.object);
  const portals = PORTALS.filter((portal) => portal.mapId === 'spiderCave').map((place) =>
    createPortal(place, groundHeightAt),
  );
  for (const portal of portals) root.add(portal.object);
  scene.add(root);

  // The cave has no sky, so the time of day does not change it. The torches always burn.
  function update(time) {
    for (const torch of torches) torch.update(time, NIGHT);
    for (const portal of portals) portal.update(time);
  }

  return { root, update };
}

function caveColorAt(x, z, height) {
  return height > WALL_HEIGHT_FROM ? WALL.clone() : FLOOR.clone();
}

// A web is spokes from its middle and rings around it, hung upright and facing the middle of the lair.
function createWeb({ x, z, radius }, groundHeightAt) {
  const points = [];
  for (let spoke = 0; spoke < WEB_SPOKES; spoke++) {
    const angle = (spoke / WEB_SPOKES) * 2 * Math.PI;
    points.push(0, 0, 0, Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  for (let ring = 1; ring <= WEB_RINGS; ring++) {
    const ringRadius = (ring / WEB_RINGS) * radius;
    for (let spoke = 0; spoke < WEB_SPOKES; spoke++) {
      const from = (spoke / WEB_SPOKES) * 2 * Math.PI;
      const to = ((spoke + 1) / WEB_SPOKES) * 2 * Math.PI;
      points.push(Math.cos(from) * ringRadius, Math.sin(from) * ringRadius, 0);
      points.push(Math.cos(to) * ringRadius, Math.sin(to) * ringRadius, 0);
    }
  }
  const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const web = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xd8d8e0, transparent: true, opacity: 0.45 }),
  );
  web.name = 'web';
  web.position.set(x, groundHeightAt(x, z) + radius + 1.5, z);
  web.lookAt(BOSS_CHAMBER.x, web.position.y, BOSS_CHAMBER.z);
  return web;
}

function createCrystalCluster({ x, z, color }, groundHeightAt) {
  const cluster = new THREE.Group();
  cluster.position.set(x, groundHeightAt(x, z), z);
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9 });
  for (const [dx, height, tilt] of [
    [0, 1.4, 0],
    [0.35, 0.9, 0.4],
    [-0.3, 1, -0.35],
  ]) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), material);
    crystal.scale.set(1, height / 0.56, 1);
    crystal.position.set(dx, height / 2, 0);
    crystal.rotation.z = tilt;
    cluster.add(crystal);
  }
  const light = new THREE.PointLight(color, CRYSTAL_LIGHT_INTENSITY, 14);
  light.name = 'crystal';
  light.position.y = 1.2;
  cluster.add(light);
  return cluster;
}
