import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { doRectanglesOverlap, screenOutlineOf } from '../src/screen-outline.js';

const view = { width: 800, height: 600 };

// A new camera sits at the origin and looks down the -z axis.
const camera = new THREE.PerspectiveCamera(60, view.width / view.height, 0.1, 100);

test('an object straight in front of the camera has an outline around the middle of the view', () => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  box.position.set(0, 0, -10);

  const outline = screenOutlineOf(box, camera, view);

  assert.ok(outline.left < 400 && outline.right > 400);
  assert.ok(outline.top < 300 && outline.bottom > 300);
});

test('an object behind the camera has no outline', () => {
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  box.position.set(0, 0, 10);

  assert.equal(screenOutlineOf(box, camera, view), null);
});

test('rectangles that share an area overlap, and rectangles that only touch do not', () => {
  const rectangle = { left: 0, right: 10, top: 0, bottom: 10 };

  assert.equal(doRectanglesOverlap(rectangle, { left: 5, right: 15, top: 5, bottom: 15 }), true);
  assert.equal(doRectanglesOverlap(rectangle, { left: 10, right: 20, top: 0, bottom: 10 }), false);
});
