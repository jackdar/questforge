import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState } from '../src/world-state.js';
import {
  createParties,
  playersSharingKill,
  INVITE_TIMEOUT_MS,
  KILL_SHARE_RANGE,
  MAX_PARTY_SIZE,
} from '../src/parties.js';

const alice = { id: 'alice', kind: 'player', name: 'Alice', faction: 'dawnguard' };
const bob = { id: 'bob', kind: 'player', name: 'Bob', faction: 'dawnguard' };
const carol = { id: 'carol', kind: 'player', name: 'Carol', faction: 'dawnguard' };
const eve = { id: 'eve', kind: 'player', name: 'Eve', faction: 'emberclaw' };

test('an accepted invitation makes a party with the inviter as leader', () => {
  const parties = createParties();

  parties.invite(alice, bob, 0);
  const result = parties.respond(bob, true, 0);

  const expectedParty = {
    leaderId: 'alice',
    members: [
      { id: 'alice', name: 'Alice' },
      { id: 'bob', name: 'Bob' },
    ],
  };
  assert.deepEqual(result, { party: expectedParty });
  assert.deepEqual(parties.partyOf('bob'), expectedParty);
  assert.deepEqual(parties.membersOf('alice'), ['alice', 'bob']);
});

test('a declined invitation makes no party and names the inviter', () => {
  const parties = createParties();

  parties.invite(alice, bob, 0);
  const result = parties.respond(bob, false, 0);

  assert.deepEqual(result, { declinedInviter: { id: 'alice', name: 'Alice' } });
  assert.equal(parties.partyOf('alice'), null);
});

test('an invitation runs out after a minute', () => {
  const parties = createParties();

  parties.invite(alice, bob, 0);

  assert.deepEqual(parties.respond(bob, true, INVITE_TIMEOUT_MS + 1), { error: 'You have no party invitation.' });
});

test('a player cannot invite a player of the other faction, a creature, or themself', () => {
  const parties = createParties();

  assert.deepEqual(parties.invite(alice, eve, 0), { error: 'You can only invite a player of your own faction.' });
  assert.deepEqual(parties.invite(alice, { id: 'wolf', kind: 'wolf' }, 0), {
    error: 'You can only invite another player.',
  });
  assert.deepEqual(parties.invite(alice, alice, 0), { error: 'You can only invite another player.' });
});

test('a player in a party cannot be invited to another party', () => {
  const parties = createParties();
  parties.invite(alice, bob, 0);
  parties.respond(bob, true, 0);

  assert.deepEqual(parties.invite(carol, bob, 0), { error: 'Bob is already in a party.' });
});

test('a full party cannot invite another player', () => {
  const parties = createParties();
  const players = Array.from({ length: MAX_PARTY_SIZE + 1 }, (_, index) => ({
    id: `player-${index}`,
    kind: 'player',
    name: `Player ${index}`,
    faction: 'dawnguard',
  }));
  for (const player of players.slice(1, MAX_PARTY_SIZE)) {
    parties.invite(players[0], player, 0);
    parties.respond(player, true, 0);
  }

  assert.deepEqual(parties.invite(players[0], players[MAX_PARTY_SIZE], 0), { error: 'Your party is full.' });
});

test('when the leader leaves, the next member leads the party', () => {
  const parties = createParties();
  for (const player of [bob, carol]) {
    parties.invite(alice, player, 0);
    parties.respond(player, true, 0);
  }

  const result = parties.leave('alice');

  assert.equal(result.remainingParty.leaderId, 'bob');
  assert.deepEqual(result.formerMemberIds, ['bob', 'carol']);
  assert.equal(parties.partyOf('alice'), null);
});

test('a party of two breaks up when one member leaves', () => {
  const parties = createParties();
  parties.invite(alice, bob, 0);
  parties.respond(bob, true, 0);

  const result = parties.leave('bob');

  assert.deepEqual(result, { remainingParty: null, formerMemberIds: ['alice'] });
  assert.equal(parties.partyOf('alice'), null);
  assert.deepEqual(parties.membersOf('alice'), ['alice']);
});

test('party members near a kill share it, and members far away or dead do not', () => {
  const world = createWorldState();
  for (const player of [alice, bob, carol]) world.addPlayer(player.id, player.name, player.faction, 1);
  world.movePlayer('carol', { x: KILL_SHARE_RANGE + 10, y: 0, z: 0, rotation: 0 });
  const parties = createParties();
  for (const player of [bob, carol]) {
    parties.invite(alice, player, 0);
    parties.respond(player, true, 0);
  }
  const corpse = { x: 0, z: 5 };

  const nearbySharers = playersSharingKill('alice', corpse, world, parties).map((player) => player.id);
  world.changeHealth('bob', -100);
  const sharersWithBobDead = playersSharingKill('alice', corpse, world, parties).map((player) => player.id);

  assert.deepEqual(nearbySharers, ['alice', 'bob']);
  assert.deepEqual(sharersWithBobDead, ['alice']);
});

test('a player without a party shares a kill with no one', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);

  const sharers = playersSharingKill('alice', { x: 0, z: 5 }, world, createParties());

  assert.deepEqual(
    sharers.map((player) => player.id),
    ['alice'],
  );
});
