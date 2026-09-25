import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MAPS } from 'questforge-shared/maps.js';
import { createMapScenery } from '../src/map-scenery.js';
import { activeMapId, activeTerrain, setActiveMap } from '../src/active-map.js';

function pointLightsNamed(scene, name) {
  const lights = [];
  scene.traverse((object) => {
    if (object.isPointLight && object.name === name) lights.push(object);
  });
  return lights;
}

test('the overworld scenery goes into the scene, and disposing it takes it out again', () => {
  const scene = new THREE.Scene();

  const scenery = createMapScenery('overworld', scene);
  const childrenWhileLoaded = scene.children.length;
  scenery.dispose();

  assert.equal(childrenWhileLoaded, 1);
  assert.equal(scene.children.length, 0);
});

test('the cave scenery is dark and lit by glowing crystals', () => {
  const scene = new THREE.Scene();

  createMapScenery('spiderCave', scene);

  const background = scene.background;
  assert.ok(background.r + background.g + background.b < 0.1);
  assert.ok(pointLightsNamed(scene, 'crystal').length >= 4);
});

test('a scenery update animates the scenery without the sky of the overworld', () => {
  const scene = new THREE.Scene();
  const scenery = createMapScenery('spiderCave', scene);

  assert.doesNotThrow(() => scenery.update(1000, 0.5, { cameraPosition: new THREE.Vector3() }));
});

test('the active map sets the terrain that the player walks on', () => {
  setActiveMap('spiderCave');
  const caveTerrain = activeTerrain();
  setActiveMap('overworld');

  assert.equal(caveTerrain, MAPS.spiderCave.terrain);
  assert.equal(activeTerrain(), MAPS.overworld.terrain);
  assert.equal(activeMapId(), 'overworld');
});

test('the lair of the Broodmother is hung with webs', () => {
  const scene = new THREE.Scene();
  createMapScenery('spiderCave', scene);
  const webs = [];
  scene.traverse((object) => {
    if (object.name === 'web') webs.push(object);
  });

  assert.ok(webs.length >= 3);
});
