import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModel } from '../src/character-model.js';
import {
  createWolfAnimator,
  BITE_DURATION_MS,
  RUN_LEG_ANGLE,
  RUN_SPEED_THRESHOLD,
  WALK_LEG_ANGLE,
} from '../src/wolf-animator.js';

const FRAME_MS = 16;
const FRAME_SECONDS = FRAME_MS / 1000;
const WALK_SPEED = 2;

test('a moving wolf swings each diagonal pair of legs together, opposite the other pair', () => {
  const { parts } = createCharacterModel('wolf');
  const animator = createWolfAnimator(parts);

  for (let now = 0; now < 100; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { speed: WALK_SPEED });

  assert.notEqual(parts.frontLeftLeg.rotation.x, 0);
  assert.equal(parts.backRightLeg.rotation.x, parts.frontLeftLeg.rotation.x);
  assert.equal(parts.frontRightLeg.rotation.x, -parts.frontLeftLeg.rotation.x);
  assert.equal(parts.backLeftLeg.rotation.x, -parts.frontLeftLeg.rotation.x);
});

test('a running wolf swings its legs further than a walking wolf', () => {
  const walking = createCharacterModel('wolf').parts;
  const running = createCharacterModel('wolf').parts;
  const walkingAnimator = createWolfAnimator(walking);
  const runningAnimator = createWolfAnimator(running);
  let largestWalkAngle = 0;
  let largestRunAngle = 0;

  for (let now = 0; now < 2000; now += FRAME_MS) {
    walkingAnimator.update(now, FRAME_SECONDS, { speed: WALK_SPEED });
    runningAnimator.update(now, FRAME_SECONDS, { speed: RUN_SPEED_THRESHOLD });
    largestWalkAngle = Math.max(largestWalkAngle, Math.abs(walking.frontLeftLeg.rotation.x));
    largestRunAngle = Math.max(largestRunAngle, Math.abs(running.frontLeftLeg.rotation.x));
  }

  assert.ok(largestWalkAngle <= WALK_LEG_ANGLE);
  assert.ok(largestRunAngle > WALK_LEG_ANGLE);
  assert.ok(largestRunAngle <= RUN_LEG_ANGLE);
});

test('a wolf that stops moving brings its legs back to rest', () => {
  const { parts } = createCharacterModel('wolf');
  const animator = createWolfAnimator(parts);

  for (let now = 0; now < 100; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { speed: WALK_SPEED });
  for (let now = 100; now < 1100; now += FRAME_MS) animator.update(now, FRAME_SECONDS, { speed: 0 });

  assert.ok(Math.abs(parts.frontLeftLeg.rotation.x) < 0.001);
});

test('a bite lowers the head and then brings it back up', () => {
  const { parts } = createCharacterModel('wolf');
  const animator = createWolfAnimator(parts);

  animator.bite(0);
  animator.update(BITE_DURATION_MS / 2, FRAME_SECONDS, { speed: 0 });
  const headAngleMidBite = parts.head.rotation.x;
  animator.update(BITE_DURATION_MS, FRAME_SECONDS, { speed: 0 });

  assert.ok(headAngleMidBite > 0);
  assert.equal(parts.head.rotation.x, 0);
});
