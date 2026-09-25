import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applySky, skyAt, SHADOW_AREA_SIZE, SHADOW_MAP_SIZE } from '../src/day-night.js';

const MIDNIGHT = 0;
const DAWN = 0.25;
const NOON = 0.5;

test('there is full daylight at noon and none at midnight', () => {
  assert.equal(skyAt(NOON).daylight, 1);
  assert.equal(skyAt(MIDNIGHT).daylight, 0);
});

test('the daylight grows through the morning', () => {
  assert.ok(skyAt(DAWN).daylight > 0);
  assert.ok(skyAt(DAWN).daylight < skyAt(0.3).daylight);
  assert.ok(skyAt(0.3).daylight <= skyAt(NOON).daylight);
});

test('the sky is brighter at noon than at midnight', () => {
  const brightness = (color) => color.r + color.g + color.b;

  assert.ok(brightness(skyAt(NOON).skyColor) > brightness(skyAt(MIDNIGHT).skyColor));
});

test('the dawn sky has more red than the noon sky', () => {
  const redShare = ({ skyColor }) => skyColor.r / (skyColor.r + skyColor.g + skyColor.b);

  assert.ok(redShare(skyAt(DAWN)) > redShare(skyAt(NOON)));
});

test('at midnight the moon lights the world from above with a dim blue light', () => {
  const midnight = skyAt(MIDNIGHT);
  const noon = skyAt(NOON);

  assert.ok(midnight.lightDirection.y > 0.99);
  assert.ok(midnight.lightColor.b > midnight.lightColor.r);
  assert.ok(midnight.lightIntensity > 0 && midnight.lightIntensity < noon.lightIntensity);
  assert.equal(midnight.moonVisibility, 1);
  assert.equal(noon.moonVisibility, 0);
});

test('the shadow light fades out at the horizon, so the swap from sun to moon does not jump', () => {
  assert.ok(skyAt(DAWN).lightIntensity < 0.01);
  assert.ok(skyAt(0.75).lightIntensity < 0.01);
});

test('the sun disc shows by day, high at noon, and hides at night', () => {
  assert.equal(skyAt(NOON).sunVisibility, 1);
  assert.ok(skyAt(NOON).sunDirection.y > 0.99);
  assert.equal(skyAt(MIDNIGHT).sunVisibility, 0);
});

test('the sun crosses the sky from east to west during the day', () => {
  const morning = skyAt(0.35).sunDirection;
  const evening = skyAt(0.65).sunDirection;

  assert.ok(Math.sign(morning.x) !== Math.sign(evening.x));
});

test('the moon moves much slower than the sun and stays high all night', () => {
  const moonAngle = ({ moonDirection }) => Math.atan2(moonDirection.y, moonDirection.x);
  const sunAngle = ({ sunDirection }) => Math.atan2(sunDirection.y, sunDirection.x);
  const earlyNight = skyAt(0.8);
  const lateNight = skyAt(0.2);

  const moonTravel = Math.abs(moonAngle(lateNight) - moonAngle(earlyNight));
  const sunTravel = Math.abs(sunAngle(skyAt(0.7)) - sunAngle(skyAt(0.3)));
  assert.ok(moonTravel < sunTravel / 2);
  for (const dayFraction of [0.76, 0.9, 0, 0.1, 0.24]) assert.ok(skyAt(dayFraction).moonDirection.y > 0.8);
});

test('the shadow light follows the player, so that there are shadows anywhere on the map', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x000000);
  const celestialLight = new THREE.DirectionalLight();
  const disc = () => new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  const playerPosition = new THREE.Vector3(-75, 0, -75);

  applySky(NOON, {
    scene,
    celestialLight,
    ambient: new THREE.HemisphereLight(),
    sunDisc: disc(),
    moonDisc: disc(),
    cameraPosition: new THREE.Vector3(),
    playerPosition,
  });

  const shadowPixel = SHADOW_AREA_SIZE / SHADOW_MAP_SIZE;
  assert.ok(celestialLight.target.position.distanceTo(playerPosition) <= shadowPixel);
  const lightOffset = celestialLight.position.clone().sub(celestialLight.target.position);
  assert.ok(lightOffset.y > 0);
});
