import * as THREE from 'three';
import {
  BRIDGE,
  groundHeightAt,
  RIVER,
  riverCenterX,
  waterLevelAt,
  WORLD_HALF_SIZE,
} from 'questforge-shared/terrain.js';

// The water surface is a ribbon along the river. It reaches a little into the banks, where the ground rises above
// it and hides its edges.
const WATER_EDGE_DISTANCE = RIVER.halfWidth + 2.5;
const WATER_SEGMENT_LENGTH = 2;
const PLANK_WIDTH = 0.5;
const PLANK_GAP = 0.06;
const DECK_THICKNESS = 0.12;
const RAIL_HEIGHT = 0.9;
const POST_SPACING = 3;
const WOOD = 0x7a5534;
const DARK_WOOD = 0x4f3520;

export function createRiverWater() {
  const rows = [];
  for (let z = -WORLD_HALF_SIZE; z <= WORLD_HALF_SIZE; z += WATER_SEGMENT_LENGTH) {
    const centerX = riverCenterX(z);
    const level = waterLevelAt(z);
    rows.push([centerX - WATER_EDGE_DISTANCE, level, z], [centerX + WATER_EDGE_DISTANCE, level, z]);
  }

  const indices = [];
  for (let row = 0; row < rows.length / 2 - 1; row++) {
    const left = row * 2;
    indices.push(left, left + 2, left + 1, left + 1, left + 2, left + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(rows.flat(), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: 0x3a6fa0,
    transparent: true,
    opacity: 0.8,
    roughness: 0.15,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const water = new THREE.Mesh(geometry, material);
  water.name = 'river';
  return water;
}

// The planks follow the deck height of the shared terrain, so the bridge looks where players walk.
export function createBridge() {
  const bridge = new THREE.Group();
  bridge.name = 'bridge';
  const length = BRIDGE.toX - BRIDGE.fromX;
  const width = BRIDGE.halfWidth * 2;

  for (let along = PLANK_WIDTH / 2; along < length; along += PLANK_WIDTH + PLANK_GAP) {
    const x = BRIDGE.fromX + along;
    const plank = createMesh(new THREE.BoxGeometry(PLANK_WIDTH, DECK_THICKNESS, width), WOOD);
    plank.position.set(x, groundHeightAt(x, BRIDGE.z) - DECK_THICKNESS / 2, BRIDGE.z);
    plank.rotation.z = Math.atan(deckSlopeAt(x));
    bridge.add(plank);
  }

  for (const side of [-1, 1]) {
    const railZ = BRIDGE.z + side * (BRIDGE.halfWidth - 0.1);
    for (let along = 0; along <= length; along += POST_SPACING) {
      const x = BRIDGE.fromX + along;
      const post = createMesh(new THREE.BoxGeometry(0.14, RAIL_HEIGHT, 0.14), DARK_WOOD);
      post.position.set(x, groundHeightAt(x, BRIDGE.z) + RAIL_HEIGHT / 2, railZ);
      bridge.add(post);
    }
    for (let along = 0; along < length; along += POST_SPACING) {
      const fromX = BRIDGE.fromX + along;
      const toX = Math.min(fromX + POST_SPACING, BRIDGE.toX);
      const fromY = groundHeightAt(fromX, BRIDGE.z) + RAIL_HEIGHT;
      const toY = groundHeightAt(toX, BRIDGE.z) + RAIL_HEIGHT;
      const rail = createMesh(new THREE.BoxGeometry(Math.hypot(toX - fromX, toY - fromY), 0.1, 0.1), WOOD);
      rail.position.set((fromX + toX) / 2, (fromY + toY) / 2, railZ);
      rail.rotation.z = Math.atan2(toY - fromY, toX - fromX);
      bridge.add(rail);
    }
  }

  bridge.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return bridge;
}

// The rise of the deck per unit along the bridge. A plank tilts by this slope, so it lies flat on the arch.
function deckSlopeAt(x) {
  const step = 0.05;
  return (groundHeightAt(x + step, BRIDGE.z) - groundHeightAt(x - step, BRIDGE.z)) / (2 * step);
}

function createMesh(geometry, color) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }));
}
