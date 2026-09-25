import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS } from 'questforge-shared/maps.js';
import { createParties } from '../src/parties.js';
import { createMapInstance } from '../src/map-instance.js';
import { createInstances, EMPTY_INSTANCE_LIFETIME_MS } from '../src/instances.js';

const alice = { id: 'alice', kind: 'player', name: 'Alice', faction: 'dawnguard', level: 1 };
const bob = { id: 'bob', kind: 'player', name: 'Bob', faction: 'dawnguard', level: 1 };
const carol = { id: 'carol', kind: 'player', name: 'Carol', faction: 'dawnguard', level: 1 };

function createTestInstances(parties) {
  return createInstances({
    parties,
    createInstance: (options) =>
      createMapInstance({ ...options, parties, sendToPlayers: () => {}, onTaggedKill: () => {} }),
  });
}

test('every player shares the one overworld instance', () => {
  const instances = createTestInstances(createParties());

  assert.equal(instances.instanceFor('overworld', 'alice'), instances.overworld);
  assert.equal(instances.instanceFor('overworld', 'bob'), instances.overworld);
});

test('the overworld instance has the dummies, NPCs, and creatures of the overworld', () => {
  const { overworld } = createTestInstances(createParties());
  const kinds = new Set(overworld.world.snapshot().map((entity) => entity.kind));

  assert.ok(kinds.has('dummy') && kinds.has('npc') && kinds.has('wolf') && kinds.has('banditLeader'));
});

test('party members share one cave instance, and a player outside the party gets a cave of their own', () => {
  const parties = createParties();
  parties.invite(alice, bob, 0);
  parties.respond(bob, true, 0);
  const instances = createTestInstances(parties);

  const aliceCave = instances.instanceFor('spiderCave', 'alice');
  aliceCave.addPlayer('alice', alice);
  const bobCave = instances.instanceFor('spiderCave', 'bob');
  const carolCave = instances.instanceFor('spiderCave', 'carol');

  assert.equal(aliceCave.mapId, 'spiderCave');
  assert.equal(bobCave, aliceCave);
  assert.notEqual(carolCave, aliceCave);
});

test('a party can go back into its cave while it is empty, before it closes', () => {
  const instances = createTestInstances(createParties());
  const cave = instances.instanceFor('spiderCave', 'alice');
  cave.addPlayer('alice', alice);
  cave.removePlayer('alice', 0);

  instances.closeEmptyInstances(EMPTY_INSTANCE_LIFETIME_MS - 1);

  assert.equal(instances.instanceFor('spiderCave', 'alice'), cave);
});

test('an empty cave closes after five minutes, so the next visit starts a fresh cave', () => {
  const instances = createTestInstances(createParties());
  const cave = instances.instanceFor('spiderCave', 'alice');
  cave.addPlayer('alice', alice);
  cave.removePlayer('alice', 0);

  instances.closeEmptyInstances(EMPTY_INSTANCE_LIFETIME_MS);

  assert.notEqual(instances.instanceFor('spiderCave', 'alice'), cave);
  assert.ok(!instances.all().includes(cave));
});

test('the overworld never closes, even when it is empty', () => {
  const instances = createTestInstances(createParties());
  instances.overworld.addPlayer('carol', carol);
  instances.overworld.removePlayer('carol', 0);

  instances.closeEmptyInstances(EMPTY_INSTANCE_LIFETIME_MS * 10);

  assert.ok(instances.all().includes(instances.overworld));
});

test('a player who enters a map through a portal stands at the arrival point, and respawns at the map spawn', () => {
  const instances = createTestInstances(createParties());
  const cave = instances.instanceFor('spiderCave', 'alice');
  const arrival = { x: 4, z: 10, rotation: 0 };

  cave.addPlayer('alice', alice, arrival);
  const arrivedAt = cave.world.getEntity('alice');
  cave.world.changeHealth('alice', -1000);
  cave.world.respawn('alice');
  const respawnedAt = cave.world.getEntity('alice');

  assert.deepEqual([arrivedAt.x, arrivedAt.z], [arrival.x, arrival.z]);
  assert.deepEqual([respawnedAt.x, respawnedAt.z], [MAPS.spiderCave.spawn.x, MAPS.spiderCave.spawn.z]);
});

test('a map instance sends its snapshot and combat events only to its own players', () => {
  const sent = [];
  const parties = createParties();
  const instance = createMapInstance({
    id: 'cave-test',
    mapId: 'spiderCave',
    parties,
    sendToPlayers: (playerIds, message) => sent.push({ playerIds, type: message.type }),
    onTaggedKill: () => {},
  });
  instance.addPlayer('alice', alice);

  instance.tick(0);

  assert.deepEqual(sent, [{ playerIds: ['alice'], type: 'snapshot' }]);
});

test('a cave instance has eight giant cave spiders and the Broodmother', () => {
  const instances = createTestInstances(createParties());
  const cave = instances.instanceFor('spiderCave', 'alice');
  const kinds = cave.world.snapshot().map((entity) => entity.kind);

  assert.equal(kinds.filter((kind) => kind === 'giantCaveSpider').length, 8);
  assert.equal(kinds.filter((kind) => kind === 'broodmother').length, 1);
});

