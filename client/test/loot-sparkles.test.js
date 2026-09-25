import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLootSparkles, SPARKLE_COUNT } from '../src/loot-sparkles.js';

const lootableCorpse = {
  state: { id: 'wolf-1', health: 0, lootableBy: ['alice'] },
  position: new THREE.Vector3(4, 0, 9),
};

test('a corpse that the local player can loot sparkles at its position', () => {
  const scene = new THREE.Scene();
  const sparkles = createLootSparkles(scene);

  sparkles.update([lootableCorpse], 'alice', 0);

  assert.equal(scene.children.length, 1);
  assert.deepEqual(scene.children[0].position.toArray(), [4, 0, 9]);
  assert.equal(scene.children[0].geometry.attributes.position.count, SPARKLE_COUNT);
});

test('a corpse that another player can loot does not sparkle', () => {
  const scene = new THREE.Scene();
  const sparkles = createLootSparkles(scene);

  sparkles.update([lootableCorpse], 'bob', 0);

  assert.equal(scene.children.length, 0);
});

test('a living creature does not sparkle', () => {
  const scene = new THREE.Scene();
  const sparkles = createLootSparkles(scene);

  sparkles.update([{ ...lootableCorpse, state: { ...lootableCorpse.state, health: 10 } }], 'alice', 0);

  assert.equal(scene.children.length, 0);
});

test('the sparkles stop when the corpse can no longer be looted', () => {
  const scene = new THREE.Scene();
  const sparkles = createLootSparkles(scene);

  sparkles.update([lootableCorpse], 'alice', 0);
  sparkles.update([{ ...lootableCorpse, state: { ...lootableCorpse.state, lootableBy: [] } }], 'alice', 16);

  assert.equal(scene.children.length, 0);
});

test('the sparkles rise over time', () => {
  const scene = new THREE.Scene();
  const sparkles = createLootSparkles(scene);

  sparkles.update([lootableCorpse], 'alice', 0);
  const firstHeight = scene.children[0].geometry.attributes.position.getY(0);
  sparkles.update([lootableCorpse], 'alice', 200);

  assert.ok(scene.children[0].geometry.attributes.position.getY(0) > firstHeight);
});
