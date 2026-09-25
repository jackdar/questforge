import * as THREE from 'three';
import { groundHeightAt } from 'questforge-shared/terrain.js';
import { WORLD_HALF_SIZE } from './world.js';
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
export function setDeadPose(root, isDead, height) {
  root.rotation.x = isDead ? -Math.PI / 2 : 0;
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
      height = groundHeightAt(mesh.position.x, mesh.position.z);
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

    // As in WoW, the direction and speed lock at take-off.
    if (!isAirborne && wantsToJump) {
      isAirborne = true;
      verticalSpeed = JUMP_SPEED;
      airVelocity.copy(inputDirection).multiplyScalar(MOVE_SPEED);
    }

    const horizontalVelocity = isAirborne ? airVelocity : inputDirection.multiplyScalar(MOVE_SPEED);
    mesh.position.addScaledVector(horizontalVelocity, deltaSeconds);
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);

    const ground = groundHeightAt(mesh.position.x, mesh.position.z);
    if (!isAirborne && ground < height - GROUND_TOLERANCE) {
      // The ground dropped away under the feet, for example at a ledge, so the character falls with its current speed.
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
