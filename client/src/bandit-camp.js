import * as THREE from 'three';
import { BANDIT_CAMP } from 'questforge-shared/places.js';
import { groundHeightAt } from 'questforge-shared/terrain.js';
import {
  createBarrel,
  createCampfire,
  createCrate,
  createDirtPatch,
  createLookoutPost,
  createTent,
  createTorch,
  enablePropShadows,
} from './camp-props.js';

// The places are relative to the middle of the camp, where the campfire burns.
// The tents stand between the fire and the ring of thugs, and each opening faces the fire.
const TENT_PLACES = [0.5, 2.6, 4.4].map((angle, index) => {
  const distance = index === 1 ? 8.5 : 8;
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
});
const CRATE_PLACES = [
  { x: 3.5, z: -9, rotation: 0.3 },
  { x: 4.3, z: -9.8, rotation: 0.9, onTop: true },
  { x: -10, z: 2.5, rotation: 1.2 },
  { x: 9.5, z: 4.5, rotation: 0.1 },
];
const BARREL_PLACES = [
  { x: 2.5, z: -10.5 },
  { x: -10.8, z: 4 },
];
// The lookout post stands at the corner side of the camp, where a guard can see the whole camp.
const LOOKOUT_PLACE = { x: -13, z: -13 };
const TORCH_PLACES = [
  { x: 11, z: 11 },
  { x: -12, z: -10 },
  { x: 14, z: -4 },
];

export function createBanditCamp() {
  const camp = new THREE.Group();
  // The camp stands on the flat top of its hill.
  camp.position.set(BANDIT_CAMP.x, groundHeightAt(BANDIT_CAMP.x, BANDIT_CAMP.z), BANDIT_CAMP.z);

  const fire = createCampfire();
  const torches = TORCH_PLACES.map((place, index) => createTorch(place, index * 1.7));
  camp.add(
    createDirtPatch(BANDIT_CAMP.radius),
    fire.object,
    ...TENT_PLACES.map((place) => createTent(place)),
    ...CRATE_PLACES.map(createCrate),
    ...BARREL_PLACES.map(createBarrel),
    createLookoutPost(LOOKOUT_PLACE),
    ...torches.map((torch) => torch.object),
  );
  enablePropShadows(camp);

  function update(time, daylight) {
    fire.update(time);
    for (const torch of torches) torch.update(time, daylight);
  }

  return { group: camp, update };
}
