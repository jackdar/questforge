import * as THREE from 'three';
import { groundHeightAt, OVERWORLD_TERRAIN, RIVER, riverCenterX } from 'questforge-shared/terrain.js';

// One vertex every two units keeps the hills smooth and the mesh small.
const VERTEX_SPACING = 2;
const SLOPE_SAMPLE_DISTANCE = 0.5;
const GRASS = new THREE.Color(0x5f8a3a);
const DARK_GRASS = new THREE.Color(0x4f7a30);
const DIRT = new THREE.Color(0x7a6848);
const MUD = new THREE.Color(0x5e4e36);
const ROCK = new THREE.Color(0x7d7a74);
const SNOW = new THREE.Color(0xeef2f5);
// Heights and slopes where the ground changes from one colour to the next.
const DIRT_SLOPE = 0.45;
const ROCK_SLOPE = 0.9;
const ROCK_HEIGHT = 14;
const SNOW_HEIGHT = 28;

// The ground follows the shared height function of the map, so it matches the height that the server uses for
// every entity. Each map colours its own ground.
export function createTerrainMesh({
  terrain = OVERWORLD_TERRAIN,
  colorAt = groundColorAt,
  vertexSpacing = VERTEX_SPACING,
} = {}) {
  const size = terrain.halfSize * 2;
  const segments = size / vertexSpacing;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const height = terrain.groundHeightAt(x, z);
    positions.setY(index, height);
    colorAt(x, z, height).toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  return ground;
}

// Flat ground is grass with some darker patches. Steep ground turns to dirt and then rock, and high peaks are snowy.
// The river bed and its banks are mud.
export function groundColorAt(x, z, height) {
  const slope = slopeAt(x, z);
  if (height > SNOW_HEIGHT) return SNOW.clone();
  if (Math.abs(x - riverCenterX(z)) < RIVER.halfWidth + RIVER.bankWidth) return MUD.clone();
  if (height > ROCK_HEIGHT || slope > ROCK_SLOPE) return ROCK.clone();
  if (slope > DIRT_SLOPE) return DIRT.clone();
  const patchiness = (Math.sin(x * 0.21) * Math.cos(z * 0.17) + 1) / 2;
  return GRASS.clone().lerp(DARK_GRASS, patchiness * 0.6);
}

export function slopeAt(x, z) {
  const height = groundHeightAt(x, z);
  const riseAlongX = groundHeightAt(x + SLOPE_SAMPLE_DISTANCE, z) - height;
  const riseAlongZ = groundHeightAt(x, z + SLOPE_SAMPLE_DISTANCE) - height;
  return Math.hypot(riseAlongX, riseAlongZ) / SLOPE_SAMPLE_DISTANCE;
}
