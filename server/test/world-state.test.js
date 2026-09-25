import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_MAX_HEIGHT } from 'questforge-shared/terrain.js';
import { createWorldState, WORLD_HALF_SIZE, MAX_HEALTH, MAX_MANA, DUMMY_LEVEL } from '../src/world-state.js';

const newAlice = {
  id: 'alice',
  kind: 'player',
  name: 'Alice',
  faction: 'dawnguard',
  level: 1,
  x: 0,
  y: 0,
  z: 0,
  rotation: 0,
  health: MAX_HEALTH,
  maxHealth: MAX_HEALTH,
  mana: MAX_MANA,
  maxMana: MAX_MANA,
};

test('a new player starts at the world origin with full health and mana', () => {
  const world = createWorldState();

  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  assert.deepEqual(world.snapshot(), [newAlice]);
});

test('a new dummy appears at its given position with full health and mana', () => {
  const world = createWorldState();

  world.addDummy('dummy-1', { x: 4, z: -10, rotation: 0.5 });

  assert.deepEqual(world.snapshot(), [
    {
      id: 'dummy-1',
      kind: 'dummy',
      name: 'Training Dummy',
      faction: null,
      level: DUMMY_LEVEL,
      x: 4,
      y: 0,
      z: -10,
      rotation: 0.5,
      health: MAX_HEALTH,
      maxHealth: MAX_HEALTH,
      mana: MAX_MANA,
      maxMana: MAX_MANA,
    },
  ]);
});

test('a removed player no longer appears in the snapshot', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);

  const removed = world.removePlayer('alice');

  assert.equal(removed, true);
  assert.deepEqual(world.snapshot().map((entity) => entity.id), ['bob']);
});

test('removing an unknown player returns false', () => {
  const world = createWorldState();

  assert.equal(world.removePlayer('ghost'), false);
});

test('removePlayer does not remove a dummy', () => {
  const world = createWorldState();
  world.addDummy('dummy-1', { x: 0, z: 0, rotation: 0 });

  const removed = world.removePlayer('dummy-1');

  assert.equal(removed, false);
  assert.equal(world.snapshot().length, 1);
});

test('moving a player updates its position and rotation', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  const moved = world.movePlayer('alice', { x: 5, y: 0, z: -3, rotation: 1.5 });

  assert.equal(moved, true);
  assert.deepEqual(world.snapshot(), [{ ...newAlice, x: 5, z: -3, rotation: 1.5 }]);
});

test('moving a player past the world edge clamps it to the edge', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.movePlayer('alice', { x: 500, y: 0, z: -500, rotation: 0 });

  const [alice] = world.snapshot();
  assert.equal(alice.x, WORLD_HALF_SIZE);
  assert.equal(alice.z, -WORLD_HALF_SIZE);
});

test('a move with non-numeric values is rejected and changes nothing', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  const moved = world.movePlayer('alice', { x: 'far', y: 0, z: NaN, rotation: 0 });

  assert.equal(moved, false);
  assert.deepEqual(world.snapshot(), [newAlice]);
});

test('moving an unknown player returns false', () => {
  const world = createWorldState();

  assert.equal(world.movePlayer('ghost', { x: 1, y: 0, z: 1, rotation: 0 }), false);
});

test('a dummy cannot be moved', () => {
  const world = createWorldState();
  world.addDummy('dummy-1', { x: 0, z: 0, rotation: 0 });

  const moved = world.movePlayer('dummy-1', { x: 9, y: 0, z: 9, rotation: 0 });

  assert.equal(moved, false);
  assert.equal(world.snapshot()[0].x, 0);
});

test('changing a snapshot does not change the world state', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.snapshot()[0].x = 99;

  assert.equal(world.snapshot()[0].x, 0);
});

test('a dead player cannot move', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.changeHealth('alice', -MAX_HEALTH);

  const moved = world.movePlayer('alice', { x: 5, y: 0, z: 5, rotation: 0 });

  assert.equal(moved, false);
  assert.equal(world.getEntity('alice').x, 0);
});

test('health never drops below zero or rises above the maximum', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  assert.equal(world.changeHealth('alice', -500), 0);
  assert.equal(world.changeHealth('alice', 500), MAX_HEALTH);
});

test('spending more mana than the entity has fails and changes nothing', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  const spent = world.spendMana('alice', MAX_MANA + 1);

  assert.equal(spent, false);
  assert.equal(world.getEntity('alice').mana, MAX_MANA);
});

test('mana regenerates up to the maximum for living entities only', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.spendMana('alice', 50);
  world.spendMana('bob', 50);
  world.changeHealth('bob', -MAX_HEALTH);

  world.regenerateMana(80);

  assert.equal(world.getEntity('alice').mana, MAX_MANA);
  assert.equal(world.getEntity('bob').mana, 50);
});

test('respawning restores full health and mana at the spawn position', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.movePlayer('alice', { x: 20, y: 0, z: 20, rotation: 1 });
  world.spendMana('alice', 40);
  world.changeHealth('alice', -MAX_HEALTH);

  world.respawn('alice');

  assert.deepEqual(world.getEntity('alice'), newAlice);
});

test('getEntity returns a copy that does not change the world state', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.getEntity('alice').health = 1;

  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('a jumping player keeps its height', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.movePlayer('alice', { x: 0, y: 1.2, z: 0, rotation: 0 });

  assert.equal(world.getEntity('alice').y, 1.2);
});

test('a player below the ground is lifted to the ground', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.movePlayer('alice', { x: 0, y: -5, z: 0, rotation: 0 });

  assert.equal(world.getEntity('alice').y, 0);
});

test('a player above the world ceiling is held at the ceiling', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  world.movePlayer('alice', { x: 0, y: WORLD_MAX_HEIGHT + 50, z: 0, rotation: 0 });

  assert.equal(world.getEntity('alice').y, WORLD_MAX_HEIGHT);
});

test('a move without a numeric height is rejected', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  const moved = world.movePlayer('alice', { x: 5, z: 5, rotation: 0 });

  assert.equal(moved, false);
  assert.equal(world.getEntity('alice').x, 0);
});

test('a player that dies in the air drops to the ground', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.movePlayer('alice', { x: 0, y: 1.2, z: 0, rotation: 0 });

  world.changeHealth('alice', -MAX_HEALTH);

  assert.equal(world.getEntity('alice').y, 0);
});
