import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS } from 'questforge-shared/factions.js';
import { NPCS } from 'questforge-shared/npcs.js';
import { CREATURES } from 'questforge-shared/creatures.js';
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

test('every NPC has a character model for its appearance', () => {
  for (const npc of Object.values(NPCS)) {
    const { root } = createCharacterModel(npc.appearance);

    assert.ok(root.children.length > 0, npc.id);
  }
});

test('every creature has a model', () => {
  for (const creature of Object.values(CREATURES)) {
    const { root } = createCharacterModel(creature.model);

    assert.ok(root.children.length > 0, creature.kind);
  }
});

test('the alpha wolf is a larger wolf with the same animatable parts', () => {
  const wolf = createCharacterModel('wolf');
  const alpha = createCharacterModel('alphaWolf');

  assert.ok(alpha.root.scale.x > wolf.root.scale.x);
  assert.deepEqual(Object.keys(alpha.parts).sort(), Object.keys(wolf.parts).sort());
});

test('the training dummy has a model without animatable parts', () => {
  const { root, parts } = createCharacterModel('dummy');

  assert.ok(root.children.length > 0);
  assert.deepEqual(parts, {});
});

test('the wolf has a model with a head, a tail, and four animatable legs', () => {
  const { parts } = createCharacterModel('wolf');

  assert.deepEqual(Object.keys(parts).sort(), [
    'backLeftLeg',
    'backRightLeg',
    'frontLeftLeg',
    'frontRightLeg',
    'head',
    'tail',
  ]);
});

test('an unknown appearance throws an error that names it', () => {
  assert.throws(() => createCharacterModel('gnome'), /No character model exists for "gnome"/);
});
