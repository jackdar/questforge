import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES } from 'questforge-shared/creatures.js';
import { SPELLS } from 'questforge-shared/spells.js';
import { createWorldState, MAX_HEALTH, MAX_MANA } from '../src/world-state.js';
import {
  createCombat,
  HEALTH_REGEN_PER_SECOND,
  MANA_REGEN_PER_SECOND,
  OUT_OF_COMBAT_DELAY_MS,
  RESPAWN_DELAY_MS,
} from '../src/combat.js';

// Players spawn at the origin with rotation 0, so they face the +z direction.
const DUMMY_IN_SPELL_RANGE = { x: 0, z: 10, rotation: 0 };
const DUMMY_IN_MELEE_RANGE = { x: 0, z: 3, rotation: 0 };
const DUMMY_BEHIND = { x: 0, z: -10, rotation: 0 };
// A projectile from the player spawn needs this long to reach a target in spell range.
const PROJECTILE_TRAVEL_MS = Math.ceil((DUMMY_IN_SPELL_RANGE.z / SPELLS.iceLance.projectileSpeed) * 1000);

test('an instant projectile spell spends mana at once and damages the target when the projectile arrives', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'iceLance', 'dummy', 0);
  const manaAfterCast = world.getEntity('alice').mana;
  combat.tick(PROJECTILE_TRAVEL_MS - 1);
  const healthBeforeArrival = world.getEntity('dummy').health;
  combat.tick(PROJECTILE_TRAVEL_MS);

  assert.deepEqual(result, { ok: true });
  assert.equal(manaAfterCast, MAX_MANA - SPELLS.iceLance.manaCost);
  assert.equal(healthBeforeArrival, MAX_HEALTH);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.iceLance.amount);
});

test('a projectile follows a target that moves away and hits it later', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', { x: 0, y: 0, z: 10, rotation: 0 });
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'iceLance', 'eve', 0);
  world.movePlayer('eve', { x: 0, y: 0, z: 20, rotation: 0 });
  combat.tick(PROJECTILE_TRAVEL_MS);
  const healthWhenFirstDistanceIsCovered = world.getEntity('eve').health;
  combat.tick(2 * PROJECTILE_TRAVEL_MS);

  assert.equal(healthWhenFirstDistanceIsCovered, MAX_HEALTH);
  assert.equal(world.getEntity('eve').health, MAX_HEALTH - SPELLS.iceLance.amount);
});

test('a projectile whose target dies before it arrives does nothing', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'iceLance', 'dummy', 0);
  world.changeHealth('dummy', -MAX_HEALTH);
  combat.tick(PROJECTILE_TRAVEL_MS);

  assert.deepEqual(
    events.map((event) => event.type),
    ['spellLaunch'],
  );
});

test('a spell with a cast time lands only when the cast time ends', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_SPELL_RANGE);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'firebolt', 'dummy', 0);
  combat.tick(SPELLS.firebolt.castTimeMs - 1);
  const eventsBeforeCastEnds = events.map((event) => event.type);
  combat.tick(SPELLS.firebolt.castTimeMs);
  const healthWhenCastEnds = world.getEntity('dummy').health;
  combat.tick(SPELLS.firebolt.castTimeMs + PROJECTILE_TRAVEL_MS);

  assert.deepEqual(eventsBeforeCastEnds, ['castStart']);
  assert.equal(healthWhenCastEnds, MAX_HEALTH);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH - SPELLS.firebolt.amount);
  assert.deepEqual(
    events.map((event) => event.type),
    ['castStart', 'castStop', 'spellLaunch', 'spellHit'],
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
  combat.tick(PROJECTILE_TRAVEL_MS);

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

  const hitTime = 100 + Math.ceil((Math.hypot(3, 3) / SPELLS.iceLance.projectileSpeed) * 1000);

  combat.startCast('alice', 'iceLance', 'eve', 100);
  combat.tick(hitTime);
  const healthAfterHit = world.getEntity('eve').health;
  combat.tick(hitTime + RESPAWN_DELAY_MS - 1);
  const healthBeforeRespawn = world.getEntity('eve').health;
  combat.tick(hitTime + RESPAWN_DELAY_MS);

  assert.equal(healthAfterHit, 0);
  assert.equal(healthBeforeRespawn, 0);
  assert.equal(world.getEntity('dummy').health, MAX_HEALTH);
  assert.equal(world.getEntity('eve').health, MAX_HEALTH);
  assert.deepEqual(events.at(-1), { type: 'respawn', entityId: 'eve', x: 0, y: 0, z: 0 });
});

test('a killed wolf respawns at its spawn point after the wolf respawn delay', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', DUMMY_IN_SPELL_RANGE);
  world.changeHealth('wolf', -(CREATURES.wolf.maxHealth - 1));
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'iceLance', 'wolf', 100);
  combat.tick(100 + PROJECTILE_TRAVEL_MS);
  combat.tick(100 + PROJECTILE_TRAVEL_MS + CREATURES.wolf.respawnDelayMs - 1);
  const healthBeforeRespawn = world.getEntity('wolf').health;
  combat.tick(100 + PROJECTILE_TRAVEL_MS + CREATURES.wolf.respawnDelayMs);

  assert.equal(healthBeforeRespawn, 0);
  assert.equal(world.getEntity('wolf').health, CREATURES.wolf.maxHealth);
  assert.deepEqual(events.at(-1), { type: 'respawn', entityId: 'wolf', x: 0, y: 0, z: 10 });
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
    ['spellLaunch', 'spellHit', 'autoAttackStart', 'spellLaunch', 'spellHit'],
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

test('a player cannot cast a creature spell such as bite', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});

  const result = combat.startCast('alice', 'bite', 'dummy', 0);

  assert.deepEqual(result, { ok: false, message: 'That spell does not exist.' });
});

test('a creature auto attack swings with its own spell', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { x: 0, z: 3, rotation: Math.PI });
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startAutoAttack('wolf', 'alice', 0, 'bite');
  combat.tick(0);

  assert.equal(world.getEntity('alice').health, MAX_HEALTH - SPELLS.bite.amount);
  assert.equal(events.at(-1).spellId, 'bite');
});

test('damage on an evading creature does nothing and shows as evade', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', DUMMY_IN_SPELL_RANGE);
  world.setEvading('wolf', true);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(PROJECTILE_TRAVEL_MS);

  assert.equal(world.getEntity('wolf').health, CREATURES.wolf.maxHealth);
  assert.deepEqual(events.at(-1), {
    type: 'spellHit',
    casterId: 'alice',
    targetId: 'wolf',
    spellId: 'iceLance',
    effect: 'evade',
    amount: 0,
  });
});

test('a player deals less damage to a creature of a higher level', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', DUMMY_IN_SPELL_RANGE, { level: 3 });
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(PROJECTILE_TRAVEL_MS);

  // Two levels below the target take a fifth off the damage.
  assert.equal(world.getEntity('wolf').health, CREATURES.wolf.maxHealth - Math.round(SPELLS.iceLance.amount * 0.8));
});

test('a creature of a higher level deals more damage to a player', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('leader', 'banditLeader', { x: 0, z: 3, rotation: Math.PI });
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startAutoAttack('leader', 'alice', 0, CREATURES.banditLeader.attackSpellId);
  combat.tick(0);

  // The leader is four levels above the player, so the hit is two fifths stronger.
  const expectedDamage = Math.round(SPELLS.heavySlash.amount * 1.4);
  assert.equal(world.getEntity('alice').health, MAX_HEALTH - expectedDamage);
  assert.equal(events.at(-1).amount, expectedDamage);
});

// Eve stands in melee range in front of Alice, so Alice can strike her at once.
const EVE_IN_MELEE_RANGE = { x: 0, y: 0, z: 3, rotation: Math.PI };
const SECONDS_PER_HEALTH_POINT = 1 / HEALTH_REGEN_PER_SECOND;

test('a hurt player regenerates no health until 15 seconds after taking damage', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', EVE_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});

  combat.tick(0);
  combat.startCast('alice', 'strike', 'eve', 0);
  combat.stopAutoAttack('alice');
  const healthAfterHit = world.getEntity('eve').health;
  for (let now = 1000; now < OUT_OF_COMBAT_DELAY_MS; now += 1000) combat.tick(now);

  assert.equal(world.getEntity('eve').health, healthAfterHit);
});

test('a hurt player out of combat regenerates one health for each two seconds', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('eve', 'Eve', 'emberclaw', 1);
  world.movePlayer('eve', EVE_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});

  combat.tick(0);
  combat.startCast('alice', 'strike', 'eve', 0);
  combat.stopAutoAttack('alice');
  const healthAfterHit = world.getEntity('eve').health;
  const regenSeconds = 10;
  for (let now = 1000; now <= OUT_OF_COMBAT_DELAY_MS + regenSeconds * 1000; now += 1000) combat.tick(now);

  // Regeneration starts at the tick that reaches 15 seconds, so that tick adds its whole second too.
  const expectedHealth = healthAfterHit + Math.floor((regenSeconds + 1) / SECONDS_PER_HEALTH_POINT);
  assert.equal(world.getEntity('eve').health, expectedHealth);
});

test('dealing damage keeps a hurt player in combat, so it regenerates no health', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', DUMMY_IN_MELEE_RANGE);
  world.changeHealth('alice', -50);
  const combat = createCombat(world, () => {});

  combat.tick(0);
  combat.startCast('alice', 'autoAttack', 'dummy', 0);
  for (let now = 1000; now <= OUT_OF_COMBAT_DELAY_MS + 10000; now += 1000) combat.tick(now);

  assert.equal(world.getEntity('alice').health, MAX_HEALTH - 50);
});

test('health regeneration stops at full health', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.changeHealth('alice', -1);
  const combat = createCombat(world, () => {});

  for (let now = 0; now <= 10000; now += 1000) combat.tick(now);

  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('a hurt creature does not regenerate health', () => {
  const world = createWorldState();
  world.addCreature('wolf', 'wolf', DUMMY_IN_SPELL_RANGE);
  world.changeHealth('wolf', -10);
  const combat = createCombat(world, () => {});

  for (let now = 0; now <= OUT_OF_COMBAT_DELAY_MS + 10000; now += 1000) combat.tick(now);

  assert.equal(world.getEntity('wolf').health, CREATURES.wolf.maxHealth - 10);
});

test('a player marked in combat regenerates no health until 15 seconds after the mark', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.changeHealth('alice', -50);
  const combat = createCombat(world, () => {});

  combat.tick(0);
  combat.markInCombat('alice', 0);
  combat.tick(OUT_OF_COMBAT_DELAY_MS - 1000);
  const healthJustBeforeTheDelay = world.getEntity('alice').health;
  combat.tick(OUT_OF_COMBAT_DELAY_MS + 1000);

  assert.equal(healthJustBeforeTheDelay, MAX_HEALTH - 50);
  assert.ok(world.getEntity('alice').health > MAX_HEALTH - 50);
});

test('a player deals 5% more damage for each level after level 1', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 6);
  world.addPlayer('eve', 'Eve', 'emberclaw', 6);
  world.movePlayer('eve', { x: 0, y: 0, z: 10, rotation: 0 });
  const combat = createCombat(world, () => {});

  combat.startCast('alice', 'iceLance', 'eve', 0);
  combat.tick(PROJECTILE_TRAVEL_MS);

  // Both players are level 6, so only the spell power of the level counts, and no level gap.
  const eve = world.getEntity('eve');
  assert.equal(eve.maxHealth - eve.health, Math.round(SPELLS.iceLance.amount * 1.25));
});

test('a player heals 5% more for each level after level 1', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 3);
  world.changeHealth('alice', -80);
  const events = [];
  const combat = createCombat(world, (event) => events.push(event));

  combat.startCast('alice', 'mend', null, 0);
  combat.tick(SPELLS.mend.castTimeMs);

  assert.equal(events.at(-1).amount, Math.round(SPELLS.mend.amount * 1.1));
});

test('in a map where creatures do not respawn, a killed creature stays dead', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { x: 2, z: 10, rotation: 0 });
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  const combat = createCombat(world, () => {}, { creaturesRespawn: false });

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(1000);
  const healthAfterHit = world.getEntity('wolf').health;
  combat.tick(1000 + CREATURES.wolf.respawnDelayMs * 2);

  assert.equal(healthAfterHit, 0);
  assert.equal(world.getEntity('wolf').health, 0);
});

// The Broodmother stands in melee range in front of Alice, facing her.
const BROODMOTHER_IN_MELEE_RANGE = { x: 0, z: 3, rotation: Math.PI };

test('poison bite hits at once and then deals its damage over time, tick by tick', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', BROODMOTHER_IN_MELEE_RANGE);
  const hits = [];
  const combat = createCombat(world, (event) => {
    if (event.type === 'spellHit') hits.push(event);
  });
  const { amount, damageOverTime } = SPELLS.poisonBite;

  combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', 0);
  for (let now = 0; now <= damageOverTime.intervalMs * (damageOverTime.ticks + 2); now += 500) combat.tick(now);

  // Alice is the same level as the Broodmother, so no level gap changes the damage.
  assert.deepEqual(
    hits.map((hit) => hit.amount),
    [amount, ...Array(damageOverTime.ticks).fill(damageOverTime.amount)],
  );
  assert.ok(hits.slice(1).every((hit) => hit.isPeriodic));
});

test('a new poison bite on the same target replaces the old poison instead of stacking', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', BROODMOTHER_IN_MELEE_RANGE);
  const periodicHits = [];
  const combat = createCombat(world, (event) => {
    if (event.isPeriodic) periodicHits.push(event);
  });
  const { cooldownMs, damageOverTime } = SPELLS.poisonBite;

  combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', 0);
  for (let now = 0; now <= cooldownMs; now += 500) combat.tick(now);
  combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', cooldownMs);
  for (let now = cooldownMs; now <= cooldownMs + damageOverTime.intervalMs * damageOverTime.ticks; now += 500) {
    combat.tick(now);
  }

  // The first poison ticks four times before the second bite, which drops its last tick and starts a full poison.
  // Two poisons at once would tick one more time.
  assert.equal(periodicHits.length, 4 + damageOverTime.ticks);
});

test('a creature ability waits for its cooldown and needs its target in range', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', BROODMOTHER_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});

  const firstCast = combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', 0);
  const castOnCooldown = combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', 1000);
  world.movePlayer('alice', { x: 0, y: 0, z: -20, rotation: 0 });
  const readyAgain = SPELLS.poisonBite.cooldownMs;
  const castOutOfRange = combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', readyAgain);

  assert.deepEqual([firstCast, castOnCooldown, castOutOfRange], [true, false, false]);
});

test('a player cannot cast a creature ability', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', BROODMOTHER_IN_MELEE_RANGE);
  const combat = createCombat(world, () => {});

  assert.deepEqual(combat.startCast('alice', 'poisonBite', 'broodmother', 0), {
    ok: false,
    message: 'That spell does not exist.',
  });
});

test('the poison stops when its target dies', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', BROODMOTHER_IN_MELEE_RANGE);
  const periodicHits = [];
  const combat = createCombat(world, (event) => {
    if (event.isPeriodic) periodicHits.push(event);
  });

  combat.castCreatureAbility('broodmother', 'poisonBite', 'alice', 0);
  world.changeHealth('alice', -10000);
  for (let now = 0; now <= 20000; now += 500) combat.tick(now);

  assert.deepEqual(periodicHits, []);
});

