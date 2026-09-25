import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModel } from '../src/character-model.js';
import { createSpiderAnimator, BITE_DURATION_MS, LEG_SWING_ANGLE } from '../src/spider-animator.js';

const FRAME_SECONDS = 0.016;

test('a spider model has a head and eight legs', () => {
  const { parts } = createCharacterModel('giantSpider');

  assert.ok(parts.head);
  assert.equal(parts.legs.length, 8);
});

test('the Broodmother is much larger than a giant spider, and a spiderling much smaller', () => {
  const scaleOf = (model) => createCharacterModel(model).root.scale.x;

  assert.ok(scaleOf('broodmother') > 2 * scaleOf('giantSpider'));
  assert.ok(scaleOf('spiderling') < scaleOf('giantSpider') / 2);
});

test('a walking spider steps its two groups of legs in opposite directions', () => {
  const { parts } = createCharacterModel('giantSpider');
  const animator = createSpiderAnimator(parts);

  for (let now = 0; now < 120; now += 16) animator.update(now, FRAME_SECONDS, { speed: 3 });

  const swingOf = (leg) => leg.rotation.y - leg.userData.restRotationY;
  assert.ok(Math.abs(swingOf(parts.legs[0])) > 0);
  assert.ok(Math.abs(swingOf(parts.legs[0])) <= LEG_SWING_ANGLE);
  assert.ok(Math.abs(swingOf(parts.legs[0]) + swingOf(parts.legs[1])) < 1e-9);
});

test('a spider bite lowers the head and then brings it back up', () => {
  const { parts } = createCharacterModel('giantSpider');
  const animator = createSpiderAnimator(parts);

  animator.bite(0);
  animator.update(BITE_DURATION_MS / 2, FRAME_SECONDS, { speed: 0 });
  const headAngleMidBite = parts.head.rotation.x;
  animator.update(BITE_DURATION_MS, FRAME_SECONDS, { speed: 0 });

  assert.ok(headAngleMidBite > 0);
  assert.equal(parts.head.rotation.x, 0);
});
