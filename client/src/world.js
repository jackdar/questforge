import * as THREE from 'three';

export const WORLD_HALF_SIZE = 100;

const TREE_COUNT = 60;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function createWorld(scene) {
  scene.background = new THREE.Color(0x87b8e0);
  scene.fog = new THREE.Fog(0x87b8e0, 60, 180);

  scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a30, 1.2));
  scene.add(createSun());
  scene.add(createGround());

  for (let index = 0; index < TREE_COUNT; index++) {
    scene.add(createTree(treePosition(index)));
  }
}

function createSun() {
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(30, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
  return sun;
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF_SIZE * 2, WORLD_HALF_SIZE * 2),
    new THREE.MeshStandardMaterial({ color: 0x5f8a3a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

// Every client must place the trees in the same spots, so this uses a spiral instead of Math.random.
function treePosition(index) {
  const angle = index * GOLDEN_ANGLE;
  const radius = 12 + ((index * 37) % 80);
  return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
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
