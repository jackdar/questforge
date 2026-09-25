import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from 'questforge-shared/factions.js';
import { createCharacterModel } from '../src/character-model.js';

test('every faction has a character model with animatable parts', () => {
  for (const factionId of Object.keys(FACTIONS)) {
    const { parts } = createCharacterModel(factionId);

    assert.deepEqual(Object.keys(parts).sort(), [
      'body',
      'leftArm',
      'leftHand',
      'leftLeg',
      'rightArm',
      'rightHand',
      'rightLeg',
      'upperBody',
    ]);
  }
});

test('the training dummy has a model without animatable parts', () => {
  const { root, parts } = createCharacterModel('dummy');

  assert.ok(root.children.length > 0);
  assert.deepEqual(parts, {});
});

test('an unknown appearance throws an error that names it', () => {
  assert.throws(() => createCharacterModel('gnome'), /No character model exists for "gnome"/);
});
