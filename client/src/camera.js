import * as THREE from 'three';

const ROTATE_SPEED = 0.005;
const ZOOM_SPEED = 0.01;
const MIN_PITCH = 0.05;
const MAX_PITCH = 1.4;
const MIN_DISTANCE = 4;
const MAX_DISTANCE = 30;
const ORBIT_HEIGHT = 1;
const LOOK_HEIGHT = 1.5;
const RIGHT_MOUSE_BUTTON = 2;

export function createThirdPersonCamera(camera, domElement) {
  // A yaw of PI puts the camera behind a character that faces +z, as a new player does at spawn.
  let yaw = Math.PI;
  let pitch = 0.4;
  let distance = 10;
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

  function update(target) {
    const horizontalDistance = Math.cos(pitch) * distance;
    camera.position.set(
      target.x + Math.sin(yaw) * horizontalDistance,
      target.y + ORBIT_HEIGHT + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * horizontalDistance,
    );
    camera.lookAt(target.x, target.y + ORBIT_HEIGHT + LOOK_HEIGHT, target.z);
    // The renderer updates the camera matrices only when it draws. Update them now, so that the nameplates and
    // damage numbers placed later in this frame use this frame's camera and do not trail one frame behind.
    camera.updateMatrixWorld();
  }

  // As in WoW, a right-button drag turns the character with the camera. A left-button drag turns only the camera.
  const isTurningCharacter = () => isDragging && dragButton === RIGHT_MOUSE_BUTTON;

  return { update, getYaw: () => yaw, isTurningCharacter };
}
