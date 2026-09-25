import * as THREE from 'three';

// Camp props are only scenery: nothing blocks movement, as with the trees. Each prop that changes over time returns
// an update that takes the time in milliseconds and the daylight from 0 (night) to 1 (day).

const CANVAS = 0xb8a47a;
const WOOD = 0x6b4a2e;
const DARK_WOOD = 0x4a321e;
const STONE = 0x7a7a78;
const FIRE_LIGHT_INTENSITY = 30;
const FIRE_LIGHT_RANGE = 18;
const TORCH_LIGHT_INTENSITY = 12;
const TORCH_LIGHT_RANGE = 11;
const TORCH_HEIGHT = 1.9;

export function createDirtPatch(radius) {
  const material = new THREE.MeshStandardMaterial({ color: 0x7a6040 });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), material);
  patch.rotation.x = -Math.PI / 2;
  // The patch sits just above the grass, so that the two surfaces do not flicker through each other.
  patch.position.y = 0.02;
  patch.receiveShadow = true;
  return patch;
}

// The flames and the light flicker with a few slow waves, so that the fire looks alive without random numbers.
export function createCampfire() {
  const group = new THREE.Group();
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const stone = createMesh(new THREE.DodecahedronGeometry(0.22), STONE);
    stone.position.set(Math.cos(angle) * 0.8, 0.12, Math.sin(angle) * 0.8);
    group.add(stone);
  }
  for (const angle of [0.4, 2]) {
    const log = createMesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), DARK_WOOD);
    log.rotation.set(Math.PI / 2, 0, angle);
    log.position.y = 0.12;
    group.add(log);
  }

  const flames = [
    { color: 0xff6a00, radius: 0.35, height: 0.9 },
    { color: 0xffc400, radius: 0.2, height: 0.6 },
  ].map(({ color, radius, height }) => createFlame(color, radius, height, 0.2));
  group.add(...flames);

  const light = new THREE.PointLight(0xff8a30, FIRE_LIGHT_INTENSITY, FIRE_LIGHT_RANGE);
  light.name = 'campfire';
  light.position.y = 1.2;
  group.add(light);

  function update(time) {
    light.intensity = FIRE_LIGHT_INTENSITY * (1 + 0.15 * flicker(time / 1000));
    flames.forEach((flame, index) => stretchFlame(flame, time / 1000, index));
  }

  return { object: group, update };
}

// A torch burns only between dusk and dawn. Its flame and light grow as the daylight fades.
export function createTorch({ x, z }, seed) {
  const torch = new THREE.Group();
  torch.position.set(x, 0, z);

  const pole = createMesh(new THREE.CylinderGeometry(0.05, 0.07, TORCH_HEIGHT, 6), DARK_WOOD);
  pole.position.y = TORCH_HEIGHT / 2;
  const head = createMesh(new THREE.CylinderGeometry(0.1, 0.07, 0.2, 8), 0x2a2a2a);
  head.position.y = TORCH_HEIGHT + 0.05;
  const flame = createFlame(0xffa020, 0.12, 0.35, TORCH_HEIGHT + 0.15);
  const light = new THREE.PointLight(0xff9a40, 0, TORCH_LIGHT_RANGE);
  light.name = 'torch';
  light.position.y = TORCH_HEIGHT + 0.4;
  torch.add(pole, head, flame, light);

  function update(time, daylight) {
    const nightness = 1 - daylight;
    const seconds = time / 1000 + seed;
    light.intensity = TORCH_LIGHT_INTENSITY * nightness * (1 + 0.2 * flicker(seconds));
    flame.visible = nightness > 0.05;
    stretchFlame(flame, seconds, 0);
  }

  return { object: torch, update };
}

// An A-frame tent: two sloped canvas sides meet at a ridge pole along the local x axis, so both open ends lie on
// that axis. The tent turns so that its x axis points at the point that it faces.
const TENT_SIDE_LENGTH = 2.2;
const TENT_SLOPE = (50 * Math.PI) / 180;

export function createTent({ x, z }, facing = { x: 0, z: 0 }) {
  const tent = new THREE.Group();
  tent.position.set(x, 0, z);
  tent.rotation.y = Math.atan2(z - facing.z, facing.x - x);

  const ridgeHeight = TENT_SIDE_LENGTH * Math.sin(TENT_SLOPE);
  const halfWidth = TENT_SIDE_LENGTH * Math.cos(TENT_SLOPE);
  for (const side of [-1, 1]) {
    const canvas = createMesh(new THREE.BoxGeometry(3, 0.05, TENT_SIDE_LENGTH), CANVAS);
    canvas.rotation.x = side * TENT_SLOPE;
    canvas.position.set(0, ridgeHeight / 2, (side * halfWidth) / 2);
    tent.add(canvas);
  }
  const ridgePole = createMesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 6), WOOD);
  ridgePole.rotation.z = Math.PI / 2;
  ridgePole.position.y = ridgeHeight;
  tent.add(ridgePole);
  return tent;
}

export function createCrate({ x, z, rotation, onTop = false }) {
  const crate = createMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), WOOD);
  crate.position.set(x, onTop ? 1.2 : 0.4, z);
  crate.rotation.y = rotation;
  return crate;
}

export function createBarrel({ x, z }) {
  const barrel = createMesh(new THREE.CylinderGeometry(0.38, 0.38, 1, 12), DARK_WOOD);
  barrel.position.set(x, 0.5, z);
  return barrel;
}

// Four posts hold a platform with a low rail, about as high as a tree trunk and a half.
export function createLookoutPost({ x, z }) {
  const post = new THREE.Group();
  post.position.set(x, 0, z);
  const height = 3.5;
  for (const [dx, dz] of [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ]) {
    const leg = createMesh(new THREE.CylinderGeometry(0.1, 0.12, height + 0.9, 8), DARK_WOOD);
    leg.position.set(dx, (height + 0.9) / 2, dz);
    post.add(leg);
  }
  const platform = createMesh(new THREE.BoxGeometry(2.2, 0.15, 2.2), WOOD);
  platform.position.y = height;
  post.add(platform);
  for (const [dx, dz, width, depth] of [
    [0, -1, 2.2, 0.08],
    [0, 1, 2.2, 0.08],
    [-1, 0, 0.08, 2.2],
    [1, 0, 0.08, 2.2],
  ]) {
    const rail = createMesh(new THREE.BoxGeometry(width, 0.08, depth), WOOD);
    rail.position.set(dx, height + 0.7, dz);
    post.add(rail);
  }
  return post;
}

// The flames glow on their own, so they cast no shadow.
export function enablePropShadows(root) {
  root.traverse((object) => {
    if (object.isMesh && !object.userData.isFlame) object.castShadow = true;
  });
}

function createFlame(color, radius, height, baseHeight) {
  const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), new THREE.MeshBasicMaterial({ color }));
  flame.userData = { isFlame: true, height, baseHeight };
  flame.position.y = baseHeight + height / 2;
  return flame;
}

function stretchFlame(flame, seconds, index) {
  const stretch = 1 + 0.12 * Math.sin(seconds * (9 + index * 4) + index);
  flame.scale.set(1, stretch, 1);
  flame.position.y = flame.userData.baseHeight + (flame.userData.height * stretch) / 2;
}

function flicker(seconds) {
  return Math.sin(seconds * 13) * 0.5 + Math.sin(seconds * 7.3) * 0.3 + Math.sin(seconds * 21.7) * 0.2;
}

function createMesh(geometry, color) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
}
