import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, PORTALS } from 'questforge-shared/maps.js';
import { loginPlaceFor } from '../src/login-place.js';

test('a character that has not played yet starts at the overworld spawn', () => {
  assert.equal(loginPlaceFor(null), MAPS.overworld.spawn);
});

test('a character logs back in where it last stood in the overworld', () => {
  assert.deepEqual(loginPlaceFor({ mapId: 'overworld', x: 40, z: -12, rotation: 1 }), { x: 40, z: -12, rotation: 1 });
});

test('a character that logged out in the cave comes back outside the cave entrance', () => {
  const exit = PORTALS.find((portal) => portal.id === 'caveExit');

  assert.equal(loginPlaceFor({ mapId: 'spiderCave', x: 0, z: 10, rotation: 0 }), exit.arrival);
});

test('a saved place outside the map starts the character at the spawn', () => {
  assert.equal(loginPlaceFor({ mapId: 'overworld', x: 9999, z: 0, rotation: 0 }), MAPS.overworld.spawn);
});
