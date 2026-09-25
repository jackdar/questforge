import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModel } from '../src/character-model.js';
import {
  createCharacterAnimator,
  CAST_ARM_ANGLE,
  CAST_RELEASE_MS,
  SWING_DURATION_MS,
  SWING_STYLES,
  LANDING_MS,
  AIR_LEG_ANGLES,
} from '../src/character-animator.js';

const FRAME_MS = 16;
const FRAME_SECONDS = FRAME_MS / 1000;
const FIRE_COLOR = '#e8641b';

test('a light swing starts with the sword arm raised over the head', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  animator.swing('light', 0);
  animator.update(0, FRAME_SECONDS, { isMoving: false });

  assert.equal(parts.rightArm.rotation.x, SWING_STYLES.light.from);
});

test('a heavy swing starts with the sword arm raised higher than a light swing', () => {
  const light = createCharacterModel('dawnguard').parts;
  const heavy = createCharacterModel('dawnguard').parts;
  const lightAnimator = createCharacterAnimator(light);
  const heavyAnimator = createCharacterAnimator(heavy);

  lightAnimator.swing('light', 0);
  heavyAnimator.swing('heavy', 0);
  lightAnimator.update(0, FRAME_SECONDS, { isMoving: false });
  heavyAnimator.update(0, FRAME_SECONDS, { isMoving: false });

  assert.ok(heavy.rightArm.rotation.x < light.rightArm.rotation.x);
});

test('a swing brings the sword arm down and forward by its end', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  animator.swing('light', 0);
  animator.update(SWING_DURATION_MS - 1, FRAME_SECONDS, { isMoving: false });

  assert.ok(Math.abs(parts.rightArm.rotation.x - SWING_STYLES.light.to) < 0.01);
});

test('the sword arm returns to rest after a swing', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);
  animator.swing('light', 0);

  for (let now = 0; now < SWING_DURATION_MS + 1000; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  assert.ok(Math.abs(parts.rightArm.rotation.x) < 0.01);
});

test('casting raises both arms forward and makes the hands glow in the spell colour', () => {
  const { parts } = createCharacterModel('emberclaw');
  const animator = createCharacterAnimator(parts);

  animator.startCast(FIRE_COLOR);
  for (let now = 0; now < 1000; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  assert.ok(Math.abs(parts.leftArm.rotation.x - CAST_ARM_ANGLE) < 0.01);
  assert.ok(Math.abs(parts.rightArm.rotation.x - CAST_ARM_ANGLE) < 0.01);
  assert.equal(`#${parts.leftHand.material.emissive.getHexString()}`, FIRE_COLOR);
  assert.ok(parts.rightHand.material.emissiveIntensity > 0);
});

test('a completed cast pushes the arms further forward and then lowers them', () => {
  const { parts } = createCharacterModel('emberclaw');
  const animator = createCharacterAnimator(parts);
  animator.startCast(FIRE_COLOR);
  for (let now = 0; now < 1000; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  animator.stopCast({ completed: true }, 1000);
  for (let now = 1000; now < 1000 + CAST_RELEASE_MS; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });
  const armAngleDuringRelease = parts.leftArm.rotation.x;
  for (let now = 1000 + CAST_RELEASE_MS; now < 3000; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  assert.ok(armAngleDuringRelease < CAST_ARM_ANGLE);
  assert.ok(Math.abs(parts.leftArm.rotation.x) < 0.01);
  assert.equal(parts.leftHand.material.emissiveIntensity, 0);
});

test('an interrupted cast lowers the arms without a push and stops the glow', () => {
  const { parts } = createCharacterModel('emberclaw');
  const animator = createCharacterAnimator(parts);
  animator.startCast(FIRE_COLOR);
  for (let now = 0; now < 1000; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  animator.stopCast({ completed: false }, 1000);
  animator.update(1000, FRAME_SECONDS, { isMoving: false });

  assert.ok(parts.leftArm.rotation.x > CAST_ARM_ANGLE);
  assert.equal(parts.leftHand.material.emissiveIntensity, 0);
});

test('an instant spell release pushes the arms forward', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  animator.release(0);
  for (let now = 0; now < CAST_RELEASE_MS; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  assert.ok(parts.leftArm.rotation.x < CAST_ARM_ANGLE);
});

test('the legs swing in opposite directions while walking', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  for (let now = 0; now < 200; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: true });

  assert.ok(Math.abs(parts.leftLeg.rotation.x) > 0.1);
  assert.ok(Math.sign(parts.leftLeg.rotation.x) === -Math.sign(parts.rightLeg.rotation.x));
});

test('the legs return to rest when the character stops walking', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);
  for (let now = 0; now < 200; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: true });

  for (let now = 200; now < 1200; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isMoving: false });

  assert.ok(Math.abs(parts.leftLeg.rotation.x) < 0.01);
  assert.ok(Math.abs(parts.rightLeg.rotation.x) < 0.01);
});

test('the legs tuck while the character is in the air', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  for (let now = 0; now < 500; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { isAirborne: true });

  assert.ok(Math.abs(parts.leftLeg.rotation.x - AIR_LEG_ANGLES.left) < 0.01);
  assert.ok(Math.abs(parts.rightLeg.rotation.x - AIR_LEG_ANGLES.right) < 0.01);
});

test('a landing dips the body and then brings it back up', () => {
  const { parts } = createCharacterModel('dawnguard');
  const animator = createCharacterAnimator(parts);

  animator.land(0);
  animator.update(LANDING_MS / 2, FRAME_SECONDS);
  const heightDuringLanding = parts.body.position.y;
  animator.update(LANDING_MS, FRAME_SECONDS);

  assert.ok(heightDuringLanding < -0.05);
  assert.equal(parts.body.position.y, 0);
});
