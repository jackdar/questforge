import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPELLS } from 'questforge-shared/spells.js';
import { createWorldState, MAX_HEALTH, MAX_MANA } from '../src/world-state.js';
import { createCombat, MANA_REGEN_PER_SECOND, RESPAWN_DELAY_MS } from '../src/combat.js';

// Players spawn at the origin with rotation 0, so they face the +z direction.
const DUMMY_IN_SPELL_RANGE = { x: 0, z: 10, rotation: 0 };
const DUMMY_IN_MELEE_RANGE = { x: 0, z: 3, rotation: 0 };
const DUMMY_BEHIND = { x: 0, z: -10, rotation: 0 };

test('an instant damage spell lowers the target health and spends mana right away', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'dummy', 0);

  assert.deepEqual(result, { ok: true });
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.iceLance.amount);
  assert.equal(world.getEntity('alice').mana, MAX_MANA - SPELLS.iceLance.manaCost);
});

test('a spell with a cast time lands only when the cast time ends', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'firebolt', 'dummy', 0);
  combat.tick(SPELLS.firebolt.castTimeMs - 1);
  const healthBeforeCastEnds = world.getEntity('dummy').health;
  combat.tick(SPELLS.firebolt.castTimeMs);

  assert.equal(healthBeforeCastEnds, MAX_HEALTH);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.firebolt.amount);
  assert.deepEqual(
    events.map((event) => event.type),
    ['castStart', 'castStop', 'spellHit'],
  );
});

test('mend without a target heals the caster', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.changeHealth('alice', -50);
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'mend', null, 0);
  combat.tick(SPELLS.mend.castTimeMs);

  assert.equal(world.getEntity('alice').health, MAX_HEALTH - 50 + SPELLS.mend.amount);
});

test('mend on the caster heals the caster', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.changeHealth('alice', -50);
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'mend', 'alice', 0);
  combat.tick(SPELLS.mend.castTimeMs);

  assert.equal(world.getEntity('alice').health, MAX_HEALTH - 50 + SPELLS.mend.amount);
});

test('mend on a hostile target heals the caster instead', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  world.changeHealth('alice', -50);
  world.changeHealth('dummy', -50);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'mend', 'dummy', 0);
  combat.tick(SPELLS.mend.castTimeMs);

  assert.equal(events[0].targetId, 'alice');
  assert.equal(world.getEntity('alice').health, MAX_HEALTH - 50 + SPELLS.mend.amount);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - 50);
});

test('mend heals a friendly target even when the caster does not face it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.movePlayer('bob', { x: 0, y: 0, z: -10, rotation: 0 });
  world.changeHealth('bob', -50);
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'mend', 'bob', 0);
  combat.tick(SPELLS.mend.castTimeMs);

  assert.equal(world.getEntity('bob').health, MAX_HEALTH - 50 + SPELLS.mend.amount);
});

test('a damage spell without a target fails', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'firebolt', null, 0);

  assert.deepEqual(result, { ok: false, message: 'You have no target.' });
});

test('a damage spell on the caster fails as an invalid target', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'alice', 0);

  assert.deepEqual(result, { ok: false, message: 'Invalid target.' });
  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('a damage spell on a friendly player fails as an invalid target', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.movePlayer('bob', { x: 0, y: 0, z: 10, rotation: 0 });
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'bob', 0);

  assert.deepEqual(result, { ok: false, message: 'Invalid target.' });
  assert.equal(world.getEntity('bob').health, MAX_HEALTH);
});

test('a damage spell on a player of the other faction hits', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', { x: 0, y: 0, z: 10, rotation: 0 });
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'iceLance', 'eve', 0);

  assert.equal(world.getEntity('eve').health, MAX_HEALTH - SPELLS.iceLance.amount);
});

test('a spell that needs facing fails when the target is behind the caster', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_BEHIND);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'You must be facing your target.' });
});

test('a cast fails when the caster turns away before it ends', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));
  combat.startCast('alice', 'firebolt', 'dummy', 0);

  world.movePlayer('alice', { x: 0, y: 0, z: 0, rotation: Math.PI });
  combat.tick(SPELLS.firebolt.castTimeMs);

  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), {
    type: 'castStop',
    casterId: 'alice',
    reason: 'failed',
    message: 'You must be facing your target.',
  });
});

test('a spell on a target beyond its maximum range fails', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', { x: 0, z: SPELLS.iceLance.maxRange + 1, rotation: 0 });
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'Out of range.' });
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
});

test('a spell fails when the caster does not have enough mana', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  world.spendMana('alice', MAX_MANA - SPELLS.firebolt.manaCost + 1);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'firebolt', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'Not enough mana.' });
});

test('an unknown spell is rejected', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'toString', null, 0);

  assert.deepEqual(result, { ok: false, message: 'That spell does not exist.' });
});

test('a caster cannot start a second cast while casting', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const combat = createCombat(world, () => {});
  combat.startCast('alice', 'firebolt', 'dummy', 0);

  const result = combat.startCast('alice', 'iceLance', 'dummy', 100);

  assert.deepEqual(result, { ok: false, message: 'You are already casting.' });
});

test('a spell on cooldown cannot be cast again until the cooldown ends', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const combat = createCombat(world, () => {});
  combat.startCast('alice', 'iceLance', 'dummy', 0);

  const tooEarly = combat.startCast('alice', 'iceLance', 'dummy', SPELLS.iceLance.cooldownMs - 1);
  const onTime = combat.startCast('alice', 'iceLance', 'dummy', SPELLS.iceLance.cooldownMs);

  assert.deepEqual(tooEarly, { ok: false, message: 'That spell is not ready yet.' });
  assert.deepEqual(onTime, { ok: true });
});

test('an interrupted cast never lands', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));
  combat.startCast('alice', 'firebolt', 'dummy', 0);

  combat.interruptCast('alice');
  combat.tick(SPELLS.firebolt.castTimeMs);

  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), { type: 'castStop', casterId: 'alice', reason: 'interrupted' });
});

test('a cast fails when the target moves out of range before the cast ends', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', { x: 0, y: 0, z: 10, rotation: 0 });
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));
  combat.startCast('alice', 'firebolt', 'eve', 0);

  world.movePlayer('eve', { x: 0, y: 0, z: SPELLS.firebolt.maxRange + 1, rotation: 0 });
  combat.tick(SPELLS.firebolt.castTimeMs);

  assert.equal(world.getEntity('eve').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), { type: 'castStop', casterId: 'alice', reason: 'failed', message: 'Out of range.' });
});

test('a dead target cannot be the target of a spell', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  world.changeHealth('dummy', -MAX_HEALTH);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'Your target is dead.' });
});

test('a killed target stops casting and respawns at its spawn point after the delay', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  world.movePlayer('eve', { x: 3, y: 0, z: 3, rotation: 0 });
  world.changeHealth('eve', -(MAX_HEALTH - SPELLS.iceLance.amount));
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));
  combat.startCast('eve', 'firebolt', 'dummy', 0);

  combat.startCast('alice', 'iceLance', 'eve', 100);
  const healthAfterHit = world.getEntity('eve').health;
  combat.tick(100 + RESPAWN_DELAY_MS - 1);
  const healthBeforeRespawn = world.getEntity('eve').health;
  combat.tick(100 + RESPAWN_DELAY_MS);

  assert.equal(healthAfterHit, 0);
  assert.equal(healthBeforeRespawn, 0);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
  assert.equal(world.getEntity('eve').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), { type: 'respawn', entityId: 'eve', x: 0, y: 0, z: 0 });
});

test('mana regenerates over time', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.spendMana('alice', 50);
  const combat = createCombat(world, () => {});

  combat.tick(0);
  combat.tick(2000);

  assert.equal(world.getEntity('alice').mana, MAX_MANA - 50 + MANA_REGEN_PER_SECOND * 2);
});

test('strike fails on a target beyond melee range', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'strike', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'Out of range.' });
});

test('strike hits at once and starts auto attack', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'strike', 'dummy', 0);
  combat.tick(0);

  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.strike.amount - SPELLS.autoAttack.amount);
  assert.deepEqual(
    events.map((event) => event.type),
    ['spellHit', 'autoAttackStart', 'spellHit'],
  );
});

test('auto attack swings once per swing interval', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});
  combat.startCast('alice', 'autoAttack', 'dummy', 0);

  combat.tick(0);
  combat.tick(SPELLS.autoAttack.swingIntervalMs - 1);
  const healthAfterFirstSwing = world.getEntity('dummy').health;
  combat.tick(SPELLS.autoAttack.swingIntervalMs);

  assert.equal(healthAfterFirstSwing, MAX_HEALTH - SPELLS.autoAttack.amount);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.autoAttack.amount * 2);
});

test('auto attack pauses while the target is out of range and resumes when it is back', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', { x: 0, y: 0, z: 20, rotation: 0 });
  const combat = createCombat(world, () => {});
  combat.startCast('alice', 'autoAttack', 'eve', 0);

  combat.tick(0);
  const healthWhileOutOfRange = world.getEntity('eve').health;
  world.movePlayer('eve', { x: 0, y: 0, z: 3, rotation: 0 });
  combat.tick(100);

  assert.equal(healthWhileOutOfRange, MAX_HEALTH);
  assert.equal(world.getEntity('eve').health, MAX_HEALTH - SPELLS.autoAttack.amount);
});

test('casting auto attack a second time turns it off', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'autoAttack', 'dummy', 0);
  combat.startCast('alice', 'autoAttack', 'dummy', 0);
  combat.tick(0);

  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), { type: 'autoAttackStop', casterId: 'alice' });
});

test('auto attack stops when asked to stop', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});
  combat.startCast('alice', 'autoAttack', 'dummy', 0);

  combat.stopAutoAttack('alice');
  combat.tick(0);

  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
});

test('auto attack stops when the target dies', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));
  combat.startCast('alice', 'autoAttack', 'dummy', 0);

  world.changeHealth('dummy', -MAX_HEALTH);
  combat.tick(0);

  assert.deepEqual(events.at(-1), { type: 'autoAttackStop', casterId: 'alice' });
});

test('auto attack on a friendly player fails as an invalid target', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'autoAttack', 'bob', 0);

  assert.deepEqual(result, { ok: false, message: 'Invalid target.' });
});
