import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES } from 'questforge-shared/creatures.js';
import { SPELLS } from 'questforge-shared/spells.js';
import { levelDamageScale } from 'questforge-shared/leveling.js';
import { createWorldState, MAX_HEALTH } from '../src/world-state.js';
import { createCombat } from '../src/combat.js';
import {
  createCreatureAi,
  MELEE_STOP_DISTANCE,
  IDLE_MS,
  RUN_SPEED,
  LEASH_DISTANCE,
} from '../src/creature-ai.js';

const TICK_MS = 50;
// Players spawn at the origin facing +z. This wolf stands outside their aggro range, but inside spell range.
const WOLF_HOME = { x: 0, z: 20 };
const WOLF_NEAR_PLAYERS = { x: 0, z: 4 };
const alwaysHalf = () => 0.5;
// With a random value of 0, a wolf wanders to its own home, so it stands still until something pulls it.
const alwaysZero = () => 0;
// An Ice Lance from the player spawn reaches a wolf near the players well within this time.
const PROJECTILE_LANDED_MS = 500;

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test('a wolf ignores a player outside its aggro range', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  for (let now = 0; now <= 5000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  assert.ok(distanceBetween(world.getEntity('wolf'), WOLF_HOME) <= CREATURES.wolf.wanderRadius);
  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('a player who walks into aggro range pulls an aggressive creature, which runs to melee range and attacks', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('thug', 'bandit', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('thug');

  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_HOME.z - CREATURES.bandit.aggroRadius + 1, rotation: 0 });
  for (let now = 0; now <= 1000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const distance = distanceBetween(world.getEntity('thug'), world.getEntity('alice'));
  assert.ok(Math.abs(distance - MELEE_STOP_DISTANCE) < 0.001);
  // The thug is two levels above Alice, so its slash hits a fifth harder.
  const slashDamage = Math.round(SPELLS.slash.amount * levelDamageScale(CREATURES.bandit.level, 1));
  assert.equal(world.getEntity('alice').health, MAX_HEALTH - slashDamage);
});

test('a pulled wolf runs at run speed', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  ai.tick(0);
  combat.tick(1000);
  ai.tick(1000);
  const zWhenPulled = world.getEntity('wolf').z;
  ai.tick(2000);

  assert.ok(Math.abs(world.getEntity('wolf').z - (zWhenPulled - RUN_SPEED)) < 0.001);
});

test('aggressive creatures further apart than twice the aggro range are pulled one at a time', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('near-thug', 'bandit', { x: 0, z: CREATURES.bandit.aggroRadius - 1, rotation: 0 });
  world.addCreature('far-thug', 'bandit', { x: 0, z: -(CREATURES.bandit.aggroRadius + 11), rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('near-thug');
  ai.addCreature('far-thug');

  for (let now = 0; now <= 3000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const alice = world.getEntity('alice');
  assert.ok(Math.abs(distanceBetween(world.getEntity('near-thug'), alice) - MELEE_STOP_DISTANCE) < 0.001);
  assert.ok(distanceBetween(world.getEntity('far-thug'), alice) > CREATURES.bandit.aggroRadius);
});

test('damage from beyond aggro range pulls the wolf onto the attacker', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= 3000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const distance = distanceBetween(world.getEntity('wolf'), world.getEntity('alice'));
  assert.ok(Math.abs(distance - MELEE_STOP_DISTANCE) < 0.001);
});

test('a projectile spell pulls the wolf only when the projectile reaches it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');
  const travelMs = (WOLF_HOME.z / SPELLS.iceLance.projectileSpeed) * 1000;

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now < travelMs; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  const zBeforeHit = world.getEntity('wolf').z;
  for (let now = Math.ceil(travelMs / TICK_MS) * TICK_MS; now <= travelMs + 500; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  assert.equal(zBeforeHit, WOLF_HOME.z);
  assert.ok(world.getEntity('wolf').z < WOLF_HOME.z);
});

test('a wolf keeps its target when another player has no more than 110% of its threat', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.movePlayer('bob', { x: 1, y: 0, z: 0, rotation: 0 });
  world.addCreature('wolf', 'wolf', { ...WOLF_NEAR_PLAYERS, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= PROJECTILE_LANDED_MS; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  combat.startCast('bob', 'iceLance', 'wolf', PROJECTILE_LANDED_MS);
  for (let now = PROJECTILE_LANDED_MS; now <= 2 * PROJECTILE_LANDED_MS; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const wolfTargets = events.filter((event) => event.type === 'autoAttackStart' && event.casterId === 'wolf');
  assert.deepEqual(
    wolfTargets.map((event) => event.targetId),
    ['alice'],
  );
});

test('a wolf changes target when another player has more than 110% of its threat', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.movePlayer('bob', { x: 1, y: 0, z: 0, rotation: 0 });
  world.addCreature('wolf', 'wolf', { ...WOLF_NEAR_PLAYERS, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= PROJECTILE_LANDED_MS; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  combat.startCast('bob', 'strike', 'wolf', PROJECTILE_LANDED_MS);
  ai.tick(PROJECTILE_LANDED_MS + TICK_MS);

  const wolfTargets = events.filter((event) => event.type === 'autoAttackStart' && event.casterId === 'wolf');
  assert.deepEqual(
    wolfTargets.map((event) => event.targetId),
    ['alice', 'bob'],
  );
});

test('a heal on a player that a wolf fights gives the healer half the heal as threat', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('carol', 'Carol', 'dawnguard', 1);
  world.movePlayer('carol', { x: 0, y: 0, z: -15, rotation: 0 });
  world.addCreature('wolf', 'wolf', { ...WOLF_NEAR_PLAYERS, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= PROJECTILE_LANDED_MS; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  combat.startCast('carol', 'mend', 'alice', PROJECTILE_LANDED_MS);
  combat.tick(PROJECTILE_LANDED_MS + SPELLS.mend.castTimeMs);
  ai.tick(PROJECTILE_LANDED_MS + SPELLS.mend.castTimeMs);

  // Half of the 30 heal is 15 threat, which is more than 110% of the 12 threat from Ice Lance.
  const wolfTargets = events.filter((event) => event.type === 'autoAttackStart' && event.casterId === 'wolf');
  assert.deepEqual(
    wolfTargets.map((event) => event.targetId),
    ['alice', 'carol'],
  );
});

test('a creature whose only target dies stops attacking and runs home', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('thug', 'bandit', { ...WOLF_NEAR_PLAYERS, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('thug');

  ai.tick(0);
  world.changeHealth('alice', -MAX_HEALTH);
  ai.tick(TICK_MS);

  assert.deepEqual(events.at(-1), { type: 'autoAttackStop', casterId: 'thug' });
  assert.equal(world.getEntity('thug').isEvading, true);
});

test('a killed wolf forgets its threat, so it does not chase the player after it respawns', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= 1000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  world.changeHealth('wolf', -CREATURES.wolf.maxHealth);
  ai.tick(1000 + TICK_MS);
  world.respawn('wolf');
  for (let now = 1000 + 2 * TICK_MS; now <= 6000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  assert.ok(distanceBetween(world.getEntity('wolf'), WOLF_HOME) <= CREATURES.wolf.wanderRadius);
});

test('a wolf out of combat walks to a point in its wander range and then rests there', () => {
  const world = createWorldState();
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  const combat = createCombat(world, () => {});
  const ai = createCreatureAi(world, combat, { random: alwaysHalf });
  ai.addCreature('wolf');

  for (let now = 0; now <= 3000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  const arrivedAt = { ...world.getEntity('wolf') };
  for (let now = 3000 + TICK_MS; now <= 3000 + IDLE_MS.min; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  assert.ok(distanceBetween(arrivedAt, WOLF_HOME) > 0);
  assert.ok(distanceBetween(arrivedAt, WOLF_HOME) <= CREATURES.wolf.wanderRadius);
  assert.deepEqual(world.getEntity('wolf'), arrivedAt);
});

test('a wolf pulled past the leash distance stops fighting, runs home, and heals to full', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');
  let wasEvading = false;

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_HOME.z - LEASH_DISTANCE - 10, rotation: 0 });
  for (let now = 0; now <= 15000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
    wasEvading ||= world.getEntity('wolf').isEvading;
  }

  const wolf = world.getEntity('wolf');
  assert.equal(wasEvading, true);
  assert.equal(wolf.isEvading, false);
  assert.deepEqual([wolf.x, wolf.z], [WOLF_HOME.x, WOLF_HOME.z]);
  assert.equal(wolf.health, CREATURES.wolf.maxHealth);
  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('an evading wolf ignores players in its aggro range on the way home', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');

  world.moveCreature('wolf', { ...WOLF_NEAR_PLAYERS, rotation: 0 });
  world.setEvading('wolf', true);
  for (let now = 0; now <= 5000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const wolf = world.getEntity('wolf');
  assert.deepEqual([wolf.x, wolf.z], [WOLF_HOME.x, WOLF_HOME.z]);
  assert.deepEqual(events, []);
});

test('an evading wolf gains no threat from damage', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');

  world.moveCreature('wolf', { x: 0, z: WOLF_HOME.z + 5, rotation: 0 });
  world.setEvading('wolf', true);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  for (let now = 0; now <= 5000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  const wolf = world.getEntity('wolf');
  assert.deepEqual([wolf.x, wolf.z], [WOLF_HOME.x, WOLF_HOME.z]);
});

test('a creature that has finished evading can be pulled again', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('thug', 'bandit', { ...WOLF_HOME, rotation: 0 });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('thug');

  world.moveCreature('thug', { x: 0, z: WOLF_HOME.z + 5, rotation: 0 });
  world.setEvading('thug', true);
  for (let now = 0; now <= 2000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }
  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_HOME.z - CREATURES.bandit.aggroRadius + 1, rotation: 0 });
  ai.tick(2000 + TICK_MS);

  assert.deepEqual(events.at(-1), { type: 'autoAttackStart', casterId: 'thug', targetId: 'alice' });
});

test('an alpha wolf pulls a player from farther away than a grey wolf does', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  const distance = CREATURES.wolf.aggroRadius + 2;
  world.addCreature('alpha', 'alphaWolf', { x: 0, z: distance, rotation: 0 });
  world.addCreature('wolf', 'wolf', { x: 0, z: -distance, rotation: 0 });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('alpha');
  ai.addCreature('wolf');

  ai.tick(0);

  assert.deepEqual(
    events.filter((event) => event.type === 'autoAttackStart').map((event) => event.casterId),
    ['alpha'],
  );
});

test('a bandit attacks with its own attack spell', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('bandit', 'bandit', { x: 0, z: 2, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('bandit');

  ai.tick(0);
  combat.tick(0);

  assert.equal(events.find((event) => event.type === 'spellLaunch').spellId, CREATURES.bandit.attackSpellId);
});

test('a creature puts every player on its threat list in combat, before its first hit lands', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('thug', 'bandit', { ...WOLF_HOME, rotation: 0 });
  const combat = createCombat(world, () => {});
  const markedInCombat = [];
  const ai = createCreatureAi(world, { ...combat, markInCombat: (entityId) => markedInCombat.push(entityId) });
  ai.addCreature('thug');

  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_HOME.z - CREATURES.bandit.aggroRadius + 1, rotation: 0 });
  ai.tick(0);

  assert.deepEqual(markedInCombat, ['thug', 'alice']);
});

test('a wolf that is out of combat puts no one in combat', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  const combat = createCombat(world, () => {});
  const markedInCombat = [];
  const ai = createCreatureAi(world, { ...combat, markInCombat: (entityId) => markedInCombat.push(entityId) });
  ai.addCreature('wolf');

  for (let now = 0; now <= 2000; now += TICK_MS) ai.tick(now);

  assert.deepEqual(markedInCombat, []);
});

test('the Broodmother casts poison bite at her target in the fight', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', { x: 0, z: 3, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('broodmother');

  ai.tick(0);

  assert.ok(events.some((event) => event.type === 'spellLaunch' && event.spellId === 'poisonBite'));
});

test('at half health the Broodmother calls spiderlings, once, and they attack her target', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', { x: 0, z: 3, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('broodmother');
  const { summon, maxHealth } = CREATURES.broodmother;

  ai.tick(0);
  const spiderlingsAtFullHealth = world.snapshot().filter((entity) => entity.kind === summon.kind).length;
  world.changeHealth('broodmother', -Math.ceil(maxHealth * (1 - summon.atHealthFraction)));
  ai.tick(TICK_MS);
  ai.tick(2 * TICK_MS);
  const spiderlings = world.snapshot().filter((entity) => entity.kind === summon.kind);

  assert.equal(spiderlingsAtFullHealth, 0);
  assert.equal(spiderlings.length, summon.count);
  for (const spiderling of spiderlings) {
    const attack = events.find((event) => event.type === 'autoAttackStart' && event.casterId === spiderling.id);
    assert.equal(attack?.targetId, 'alice');
  }
});

test('when the Broodmother resets, her spiderlings go away, so the next attempt starts the same way', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 9);
  world.addCreature('broodmother', 'broodmother', { x: 0, z: 3, rotation: Math.PI });
  let ai = null;
  const combat = createCombat(world, (event) => ai.handleCombatEvent(event));
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('broodmother');
  const { summon, maxHealth } = CREATURES.broodmother;

  ai.tick(0);
  world.changeHealth('broodmother', -Math.ceil(maxHealth * (1 - summon.atHealthFraction)));
  ai.tick(TICK_MS);
  world.changeHealth('alice', -10000);
  ai.tick(2 * TICK_MS);

  assert.equal(world.getEntity('broodmother').isEvading, true);
  assert.deepEqual(
    world.snapshot().filter((entity) => entity.kind === summon.kind),
    [],
  );
});

test('a neutral grey wolf ignores a player who walks right up to it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { ...WOLF_HOME, rotation: 0 });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');

  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_HOME.z - 2, rotation: 0 });
  for (let now = 0; now <= 3000; now += TICK_MS) {
    combat.tick(now);
    ai.tick(now);
  }

  assert.deepEqual(events, []);
  assert.equal(world.getEntity('alice').health, MAX_HEALTH);
});

test('a neutral grey wolf fights back once a player attacks it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', { x: 0, z: 3, rotation: Math.PI });
  const events = [];
  let ai = null;
  const combat = createCombat(world, (event) => {
    events.push(event);
    ai.handleCombatEvent(event);
  });
  ai = createCreatureAi(world, combat, { random: alwaysZero });
  ai.addCreature('wolf');

  combat.startCast('alice', 'strike', 'wolf', 0);
  ai.tick(0);

  assert.ok(events.some((event) => event.type === 'autoAttackStart' && event.casterId === 'wolf'));
});

