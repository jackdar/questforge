import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BANDIT_CAMP, STARTING_CAMP } from 'questforge-shared/places.js';
import { treePositions } from '../src/world.js';
import { createBanditCamp } from '../src/bandit-camp.js';
import { createStartingCamp } from '../src/starting-camp.js';
import { createBridge } from '../src/river.js';
import { BRIDGE, groundHeightAt, RIVER, riverCenterX } from 'questforge-shared/terrain.js';

const DAY = 1;
const NIGHT = 0;

function lightsNamed(group, name) {
  const lights = [];
  group.traverse((object) => {
    if (object.isPointLight && object.name === name) lights.push(object);
  });
  return lights;
}

test('no tree grows inside a camp', () => {
  for (const camp of [BANDIT_CAMP, STARTING_CAMP]) {
    for (const position of treePositions()) {
      assert.ok(Math.hypot(position.x - camp.x, position.z - camp.z) > camp.radius);
    }
  }
});

test('the bandit camp stands at its shared place and has a campfire light', () => {
  const { group } = createBanditCamp();

  assert.deepEqual([group.position.x, group.position.z], [BANDIT_CAMP.x, BANDIT_CAMP.z]);
  assert.equal(lightsNamed(group, 'campfire').length, 1);
});

test('the campfire light flickers over time', () => {
  const { group, update } = createBanditCamp();
  const [light] = lightsNamed(group, 'campfire');

  update(0, DAY);
  const firstIntensity = light.intensity;
  update(137, DAY);

  assert.notEqual(light.intensity, firstIntensity);
});

test('every tent opening faces the campfire', () => {
  const { group } = createBanditCamp();
  const tents = group.children.filter((child) => child.isGroup && child.children.every((part) => part.isMesh));
  const canvasTents = tents.filter((tent) => tent.children.length === 3);

  for (const tent of canvasTents) {
    const ridgeDirection = new THREE.Vector3(1, 0, 0).applyEuler(tent.rotation);
    const towardFire = tent.position.clone().negate().normalize();
    assert.ok(Math.abs(ridgeDirection.dot(towardFire)) > 0.99);
  }
  assert.equal(canvasTents.length, 3);
});

test('the starting camp stands behind the player spawn with a campfire and a ring of torches', () => {
  const { group } = createStartingCamp();

  assert.deepEqual([group.position.x, group.position.z], [STARTING_CAMP.x, STARTING_CAMP.z]);
  assert.equal(lightsNamed(group, 'campfire').length, 1);
  assert.equal(lightsNamed(group, 'torch').length, 6);
});

test('the torches give no light by day and light the camp at night', () => {
  const { group, update } = createStartingCamp();
  const torches = lightsNamed(group, 'torch');

  update(0, DAY);
  const dayIntensities = torches.map((torch) => torch.intensity);
  update(0, NIGHT);

  assert.ok(dayIntensities.every((intensity) => intensity === 0));
  assert.ok(torches.every((torch) => torch.intensity > 0));
});

test('no tree grows in the river or on its banks', () => {
  for (const position of treePositions()) {
    assert.ok(Math.abs(position.x - riverCenterX(position.z)) > RIVER.halfWidth + RIVER.bankWidth);
  }
});

test('the bridge planks lie on the deck that players walk on', () => {
  const bridge = createBridge();
  const middlePlank = bridge.children.find((part) => Math.abs(part.position.x - riverCenterX(BRIDGE.z)) < 0.3);

  const deckTop = middlePlank.position.y + middlePlank.geometry.parameters.height / 2;
  assert.ok(Math.abs(deckTop - groundHeightAt(middlePlank.position.x, BRIDGE.z)) < 0.05);
});
