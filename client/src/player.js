import * as THREE from 'three';
import { MAX_WALKABLE_SLOPE } from 'questforge-shared/terrain.js';
import { activeTerrain } from './active-map.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.js';
import { createCharacterAnimator } from './character-animator.js';
import { isTypingInFormField } from './keyboard.js';

const MOVE_SPEED = 8;
// These values give a jump about 1.2 units high that lasts about 0.6 seconds.
const JUMP_SPEED = 8;
const GRAVITY = 26;
const GROUND_TOLERANCE = 0.01;
const LYING_HEIGHT = 0.2;

// The character root uses the rotation order YXZ, so that a dead character falls onto its back whichever way it faces.
// A four-legged creature falls onto its side instead.
export function setDeadPose(root, isDead, height, { fallsOnSide = false } = {}) {
  const fallAngle = isDead ? -Math.PI / 2 : 0;
  root.rotation.x = fallsOnSide ? 0 : fallAngle;
  root.rotation.z = fallsOnSide ? fallAngle : 0;
  root.position.y = height + (isDead ? LYING_HEIGHT : 0);
}

export function createPlayer(scene) {
  const mesh = new THREE.Group();
  mesh.rotation.order = 'YXZ';
  scene.add(mesh);
  let animator = null;

  // The height of the feet. The dead pose lifts the model above it, so the model height is not the game height.
  let height = 0;
  let verticalSpeed = 0;
  let isAirborne = false;
  let isJumpRequested = false;
  const airVelocity = new THREE.Vector3();

  const pressedKeys = new Set();
  window.addEventListener('keydown', (event) => {
    if (isTypingInFormField(event)) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) isJumpRequested = true;
    }
    pressedKeys.add(event.code);
  });
  window.addEventListener('keyup', (event) => pressedKeys.delete(event.code));
  window.addEventListener('blur', () => pressedKeys.clear());

  function axis(positiveKey, negativeKey) {
    return Number(pressedKeys.has(positiveKey)) - Number(pressedKeys.has(negativeKey));
  }

  function setAppearance(faction) {
    for (const oldModel of [...mesh.children]) {
      mesh.remove(oldModel);
      disposeCharacterModel(oldModel);
    }

    const { root, parts } = createCharacterModel(faction);
    mesh.add(root);
    animator = createCharacterAnimator(parts);
  }

  function setPosition({ x, y, z, rotation }) {
    mesh.position.set(x, y, z);
    if (rotation !== undefined) mesh.rotation.y = rotation;
    height = y;
    verticalSpeed = 0;
    isAirborne = false;
  }

  function update(deltaSeconds, cameraYaw, { isDead, isTurningWithCamera, now }) {
    const wantsToJump = isJumpRequested;
    isJumpRequested = false;

    if (isDead) {
      height = activeTerrain().groundHeightAt(mesh.position.x, mesh.position.z);
      isAirborne = false;
      verticalSpeed = 0;
      setDeadPose(mesh, true, height);
      return;
    }

    const forwardInput = axis('KeyW', 'KeyS');
    const strafeInput = axis('KeyD', 'KeyA');
    const inputDirection = moveDirection(cameraYaw, forwardInput, strafeInput);
    const hasMoveInput = inputDirection.lengthSq() > 0;

    // Face the camera's forward direction, so that A and D strafe and S walks backwards.
    // In the air only a right-button drag turns the character, as in WoW.
    if ((hasMoveInput && !isAirborne) || isTurningWithCamera) mesh.rotation.y = cameraYaw + Math.PI;

    // Wading through the river slows the character. A jump keeps the speed it had at take-off.
    const speedFactor = activeTerrain().movementSpeedFactorAt(mesh.position.x, mesh.position.z);
    const groundSpeed = MOVE_SPEED * speedFactor;

    // As in WoW, the direction and speed lock at take-off.
    if (!isAirborne && wantsToJump) {
      isAirborne = true;
      verticalSpeed = JUMP_SPEED;
      airVelocity.copy(inputDirection).multiplyScalar(groundSpeed);
    }

    const horizontalVelocity = isAirborne ? airVelocity : inputDirection.multiplyScalar(groundSpeed);
    const stepDistance = horizontalVelocity.length() * deltaSeconds;
    moveHorizontally(horizontalVelocity, deltaSeconds);

    // Walking down a slope keeps the feet on the ground. Only a drop steeper than a walkable slope, such as a ledge,
    // makes the character fall with its current speed.
    const ground = activeTerrain().groundHeightAt(mesh.position.x, mesh.position.z);
    const walkableDrop = GROUND_TOLERANCE + stepDistance * MAX_WALKABLE_SLOPE;
    if (!isAirborne && ground < height - walkableDrop) {
      isAirborne = true;
      verticalSpeed = 0;
      airVelocity.copy(horizontalVelocity);
    }

    if (isAirborne) {
      verticalSpeed -= GRAVITY * deltaSeconds;
      height += verticalSpeed * deltaSeconds;
      if (height <= ground) {
        height = ground;
        verticalSpeed = 0;
        isAirborne = false;
        animator?.land(now);
      }
    } else {
      height = ground;
    }

    setDeadPose(mesh, false, height);
    animator?.update(now, deltaSeconds, { isMoving: hasMoveInput && !isAirborne, isAirborne });
  }

  // On the ground, a step that climbs steeper than a walkable slope does not happen. The character then slides
  // along the slope on one axis if that axis is walkable, so it can walk along a mountainside instead of sticking.
  function moveHorizontally(velocity, deltaSeconds) {
    const step = { x: velocity.x * deltaSeconds, z: velocity.z * deltaSeconds };
    const candidates = isAirborne
      ? [step]
      : [step, { x: step.x, z: 0 }, { x: 0, z: step.z }].filter(({ x, z }) => x !== 0 || z !== 0);
    const walkableStep = candidates.find((candidate) => isAirborne || isWalkable(candidate));
    if (!walkableStep) return;

    const { halfSize } = activeTerrain();
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x + walkableStep.x, -halfSize, halfSize);
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z + walkableStep.z, -halfSize, halfSize);
  }

  function isWalkable({ x, z }) {
    const distance = Math.hypot(x, z);
    const rise = activeTerrain().groundHeightAt(mesh.position.x + x, mesh.position.z + z) - height;
    return rise <= distance * MAX_WALKABLE_SLOPE + GROUND_TOLERANCE;
  }

  function getMovementState() {
    return { x: mesh.position.x, y: height, z: mesh.position.z, rotation: mesh.rotation.y };
  }

  return { mesh, update, setAppearance, setPosition, getMovementState, getAnimator: () => animator };
}

function moveDirection(cameraYaw, forwardInput, strafeInput) {
  if (forwardInput === 0 && strafeInput === 0) return new THREE.Vector3();

  const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  return forward.multiplyScalar(forwardInput).addScaledVector(right, strafeInput).normalize();
}
