import * as THREE from 'three';
import { activeTerrain } from './active-map.js';

const ROTATE_SPEED = 0.005;
const CAMERA_CLEARANCE = 0.5;
const CLEARANCE_STEP = 0.2;
// The camera never comes closer than this, so the character model does not fill the whole screen.
const MIN_CLEAR_DISTANCE = 0.6;
const ZOOM_SPEED = 0.01;
const MIN_PITCH = 0.05;
const MAX_PITCH = 1.4;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 30;
const ORBIT_HEIGHT = 1;
const LOOK_HEIGHT = 1.5;
const RIGHT_MOUSE_BUTTON = 2;
// How fast the camera moves back out after an obstacle stops blocking it, as a fraction of the gap per second.
const RETURN_RATE = 6;

export function createThirdPersonCamera(camera, domElement) {
  // A yaw of PI puts the camera behind a character that faces +z, as a new player does at spawn.
  let yaw = Math.PI;
  let pitch = 0.4;
  let distance = 10;
  let shownDistance = distance;
  let isDragging = false;
  let dragButton = null;

  domElement.addEventListener('contextmenu', (event) => event.preventDefault());

  domElement.addEventListener('pointerdown', (event) => {
    isDragging = true;
    dragButton = event.button;
    domElement.setPointerCapture(event.pointerId);
  });

  domElement.addEventListener('pointerup', (event) => {
    isDragging = false;
    dragButton = null;
    domElement.releasePointerCapture(event.pointerId);
  });

  domElement.addEventListener('pointermove', (event) => {
    if (!isDragging) return;
    yaw -= event.movementX * ROTATE_SPEED;
    pitch = THREE.MathUtils.clamp(pitch + event.movementY * ROTATE_SPEED, MIN_PITCH, MAX_PITCH);
  });

  domElement.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * ZOOM_SPEED, MIN_DISTANCE, MAX_DISTANCE);
    },
    { passive: false },
  );

  // As in WoW, the camera comes closer instead of going into a wall, a hill, or a ceiling behind the player.
  function update(target, deltaSeconds) {
    const pivot = new THREE.Vector3(target.x, target.y + ORBIT_HEIGHT, target.z);
    const direction = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const clearDistance = clearCameraDistance(pivot, direction, distance, activeTerrain());
    shownDistance = nextShownDistance(shownDistance, clearDistance, deltaSeconds);
    camera.position.copy(pivot).addScaledVector(direction, shownDistance);
    camera.lookAt(cameraLookPoint(pivot, direction, distance, shownDistance));
    // The renderer updates the camera matrices only when it draws. Update them now, so that the nameplates and
    // damage numbers placed later in this frame use this frame's camera and do not trail one frame behind.
    camera.updateMatrixWorld();
  }

  // As in WoW, a right-button drag turns the character with the camera. A left-button drag turns only the camera.
  const isTurningCharacter = () => isDragging && dragButton === RIGHT_MOUSE_BUTTON;

  return { update, getYaw: () => yaw, isTurningCharacter };
}

// The camera jumps in at once, so it never shows the inside of a wall, and glides back out, so it does not flicker
// while the player walks along a wall.
export function nextShownDistance(shownDistance, clearDistance, deltaSeconds) {
  if (clearDistance <= shownDistance) return clearDistance;
  return shownDistance + (clearDistance - shownDistance) * Math.min(RETURN_RATE * deltaSeconds, 1);
}

// A camera that an obstacle pushes in keeps the view direction that it has at its wanted distance. It aims at a
// point above the head of the character, and without this it would look steeply up when it comes very close.
export function cameraLookPoint(pivot, direction, wantedDistance, shownDistance) {
  return pivot
    .clone()
    .add(new THREE.Vector3(0, LOOK_HEIGHT, 0))
    .addScaledVector(direction, shownDistance - wantedDistance);
}

// The distance from the pivot, along the direction, that the camera can go before the ground or the ceiling is too
// close. The camera then stops just before the obstacle.
export function clearCameraDistance(pivot, direction, wantedDistance, terrain) {
  const point = new THREE.Vector3();
  for (let travelled = CLEARANCE_STEP; travelled <= wantedDistance; travelled += CLEARANCE_STEP) {
    point.copy(pivot).addScaledVector(direction, travelled);
    const isInGround = terrain.groundHeightAt(point.x, point.z) + CAMERA_CLEARANCE > point.y;
    const isInCeiling = terrain.ceilingHeight !== undefined && point.y > terrain.ceilingHeight - CAMERA_CLEARANCE;
    if (isInGround || isInCeiling) return Math.max(travelled - CLEARANCE_STEP, MIN_CLEAR_DISTANCE);
  }
  return wantedDistance;
}
