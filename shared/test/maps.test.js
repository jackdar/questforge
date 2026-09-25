import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, PORTALS, PORTAL_RADIUS, portalAt } from '../maps.js';
import { MAX_WALKABLE_SLOPE } from '../terrain.js';
import { BOSS_CHAMBER, SPIDER_CHAMBERS } from '../cave-terrain.js';

// Walks a grid of one unit from the start and returns true when it reaches the goal without a step steeper than a
// player can walk.
function canWalk(terrain, from, to) {
  const key = (x, z) => `${x},${z}`;
  const start = { x: Math.round(from.x), z: Math.round(from.z) };
  const goal = { x: Math.round(to.x), z: Math.round(to.z) };
  const visited = new Set([key(start.x, start.z)]);
  const queue = [start];
  while (queue.length > 0) {
    const { x, z } = queue.shift();
    if (x === goal.x && z === goal.z) return true;
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: x + dx, z: z + dz };
      if (Math.abs(next.x) > terrain.halfSize || Math.abs(next.z) > terrain.halfSize) continue;
      if (visited.has(key(next.x, next.z))) continue;
      const rise = terrain.groundHeightAt(next.x, next.z) - terrain.groundHeightAt(x, z);
      if (rise > MAX_WALKABLE_SLOPE) continue;
      visited.add(key(next.x, next.z));
      queue.push(next);
    }
  }
  return false;
}

test('every portal leads from one existing map to another', () => {
  for (const portal of PORTALS) {
    assert.ok(MAPS[portal.mapId], portal.id);
    assert.ok(MAPS[portal.toMapId], portal.id);
    assert.notEqual(portal.mapId, portal.toMapId, portal.id);
  }
});

test('every arrival point stands clear of the portals, so a player does not bounce straight back', () => {
  for (const portal of PORTALS) {
    assert.equal(portalAt(portal.toMapId, portal.arrival), undefined, portal.id);
  }
});

test('a player finds a portal within its radius and not beyond it', () => {
  const [entrance] = PORTALS;

  assert.equal(portalAt(entrance.mapId, { x: entrance.x + PORTAL_RADIUS - 0.1, z: entrance.z }), entrance);
  assert.equal(portalAt(entrance.mapId, { x: entrance.x + PORTAL_RADIUS + 0.1, z: entrance.z }), undefined);
  assert.equal(portalAt('spiderCave', entrance), undefined);
});

test('a player can walk from the overworld spawn to the cave portal', () => {
  const entrance = PORTALS.find((portal) => portal.id === 'caveEntrance');

  assert.ok(canWalk(MAPS.overworld.terrain, MAPS.overworld.spawn, entrance));
});

test('the cave portal stands in a cave mouth, with walls too steep to climb behind it and at its sides', () => {
  const entrance = PORTALS.find((portal) => portal.id === 'caveEntrance');
  const { groundHeightAt } = MAPS.overworld.terrain;
  const floor = groundHeightAt(entrance.x, entrance.z);

  for (const [dx, dz] of [
    [9, 9],
    [9, -9],
    [-9, 9],
  ]) {
    assert.ok(groundHeightAt(entrance.x + dx, entrance.z + dz) - floor > 8, `${dx}, ${dz}`);
  }
});

test('inside the cave, a player can walk from the spawn to the exit portal, and cannot climb out of the hall', () => {
  const exit = PORTALS.find((portal) => portal.id === 'caveExit');
  const { terrain, spawn } = MAPS.spiderCave;

  assert.ok(canWalk(terrain, spawn, exit));
  assert.ok(!canWalk(terrain, spawn, { x: 0, z: terrain.halfSize - 1 }));
});

test('inside the cave, a player can walk from the spawn through both spider chambers to the boss chamber', () => {
  const { terrain, spawn } = MAPS.spiderCave;

  for (const chamber of [...SPIDER_CHAMBERS, BOSS_CHAMBER]) assert.ok(canWalk(terrain, spawn, chamber));
});

test('the boss chamber is the widest part of the cave', () => {
  for (const chamber of SPIDER_CHAMBERS) assert.ok(BOSS_CHAMBER.radius > chamber.radius);
});

test('every map plays a song', () => {
  for (const map of Object.values(MAPS)) assert.equal(typeof map.songId, 'string', map.id);
});
