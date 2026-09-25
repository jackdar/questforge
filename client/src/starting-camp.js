import * as THREE from 'three';
import { STARTING_CAMP } from 'questforge-shared/places.js';
import { groundHeightAt } from 'questforge-shared/terrain.js';
import {
  createBarrel,
  createCampfire,
  createCrate,
  createDirtPatch,
  createTent,
  createTorch,
  enablePropShadows,
} from './camp-props.js';

// The small camp of the militia stands just behind the player spawn. The places are relative to its campfire.
const TENT_PLACES = [
  { x: -4.5, z: -3 },
  { x: 4.5, z: -3 },
];
const CRATE_PLACES = [
  { x: -6.5, z: 1.5, rotation: 0.4 },
  { x: 6.8, z: 1, rotation: 1.1 },
];
const BARREL_PLACES = [{ x: 0, z: -5.5 }];
// The torches stand in a ring around the camp, so that the spawn and the quest givers stay lit at night.
const TORCH_PLACES = Array.from({ length: 6 }, (_, index) => {
  const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
  return { x: Math.cos(angle) * 8, z: Math.sin(angle) * 8 };
});

export function createStartingCamp() {
  const camp = new THREE.Group();
  camp.position.set(STARTING_CAMP.x, groundHeightAt(STARTING_CAMP.x, STARTING_CAMP.z), STARTING_CAMP.z);

  const fire = createCampfire();
  const torches = TORCH_PLACES.map((place, index) => createTorch(place, index * 1.3));
  camp.add(
    createDirtPatch(STARTING_CAMP.radius),
    fire.object,
    ...TENT_PLACES.map((place) => createTent(place)),
    ...CRATE_PLACES.map(createCrate),
    ...BARREL_PLACES.map(createBarrel),
    ...torches.map((torch) => torch.object),
  );
  enablePropShadows(camp);

  function update(time, daylight) {
    fire.update(time);
    for (const torch of torches) torch.update(time, daylight);
  }

  return { group: camp, update };
}
