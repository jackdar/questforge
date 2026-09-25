import { CREATURES } from 'questforge-shared/creatures.js';

export const WALK_SPEED = 2;
export const RUN_SPEED = 7;
export const MELEE_STOP_DISTANCE = 2.5;
export const LEASH_DISTANCE = 40;
export const IDLE_MS = { min: 3000, max: 8000 };
// A called creature appears this far from the boss, spread in a circle around it.
export const SUMMON_DISTANCE = 3;
export const HEAL_THREAT_PER_POINT = 0.5;
// As in WoW, a creature changes target only when another player has clearly more threat.
// This stops the creature from turning back and forth between two players.
export const TARGET_SWITCH_THREAT_RATIO = 1.1;

export function createCreatureAi(world, combat, { random = Math.random } = {}) {
  const creatures = new Map();
  let lastTickTime = null;

  let summonCount = 0;

  function addCreature(id) {
    const { x, z } = world.getEntity(id);
    creatures.set(id, {
      home: { x, z },
      threat: new Map(),
      targetId: null,
      wanderPoint: null,
      idleUntil: 0,
      summonedIds: [],
    });
  }

  function handleCombatEvent(event) {
    if (event.type !== 'spellHit') return;
    const { casterId, targetId, effect, amount } = event;
    if (effect === 'damage') addThreat(targetId, casterId, amount);
    if (effect === 'heal') addHealThreat(casterId, targetId, amount);
  }

  function addThreat(creatureId, sourceId, amount) {
    const creature = creatures.get(creatureId);
    if (!creature || creatures.has(sourceId) || world.getEntity(creatureId)?.isEvading) return;
    creature.threat.set(sourceId, (creature.threat.get(sourceId) ?? 0) + amount);
  }

  // A heal on a player that a creature fights makes the healer a threat to that creature too.
  function addHealThreat(healerId, healedId, amount) {
    for (const [creatureId, creature] of creatures) {
      if (creature.threat.has(healedId)) addThreat(creatureId, healerId, amount * HEAL_THREAT_PER_POINT);
    }
  }

  function tick(now) {
    const elapsedSeconds = lastTickTime === null ? 0 : (now - lastTickTime) / 1000;
    lastTickTime = now;
    const livingPlayers = world.snapshot().filter((entity) => entity.kind === 'player' && entity.health > 0);

    for (const [id, creature] of creatures) {
      const entity = world.getEntity(id);
      if (!entity || entity.health === 0) {
        forgetFight(id, creature);
        continue;
      }

      if (entity.isEvading) {
        runHome(entity, creature, elapsedSeconds, now);
        continue;
      }

      const { aggroRadius, isNeutral } = CREATURES[entity.kind];
      if (!isNeutral) pullPlayersInAggroRange(entity, creature, livingPlayers, aggroRadius);
      dropGoneAndDeadThreats(creature);
      const isInFight = creature.targetId !== null;
      const isPastLeash = distanceBetween(entity, creature.home) > LEASH_DISTANCE;
      if (creature.threat.size > 0 && !isPastLeash) fight(entity, creature, elapsedSeconds, now);
      else if (isInFight) startEvading(entity.id, creature);
      else wander(entity, creature, elapsedSeconds, now);
    }
  }

  function pullPlayersInAggroRange(entity, creature, livingPlayers, aggroRadius) {
    for (const player of livingPlayers) {
      const isInAggroRange = distanceBetween(player, entity) <= aggroRadius;
      if (isInAggroRange && !creature.threat.has(player.id)) creature.threat.set(player.id, 0);
    }
  }

  function dropGoneAndDeadThreats(creature) {
    for (const sourceId of creature.threat.keys()) {
      const source = world.getEntity(sourceId);
      if (!source || source.health === 0) creature.threat.delete(sourceId);
    }
  }

  // A creature that chases a player puts that player in combat, even before its first hit lands.
  function fight(entity, creature, elapsedSeconds, now) {
    combat.markInCombat(entity.id, now);
    for (const playerId of creature.threat.keys()) combat.markInCombat(playerId, now);

    const targetId = chooseTarget(creature);
    if (creature.targetId !== targetId) {
      creature.targetId = targetId;
      combat.startAutoAttack(entity.id, targetId, now, CREATURES[entity.kind].attackSpellId);
    }

    const target = world.getEntity(targetId);
    const step = RUN_SPEED * world.movementSpeedFactorAt(entity.x, entity.z) * elapsedSeconds;
    world.moveCreature(entity.id, moveToward(entity, target, step, MELEE_STOP_DISTANCE));

    const { abilities = [], summon } = CREATURES[entity.kind];
    for (const spellId of abilities) combat.castCreatureAbility(entity.id, spellId, targetId, now);
    const hasReachedSummonHealth = summon && entity.health <= entity.maxHealth * summon.atHealthFraction;
    if (hasReachedSummonHealth && creature.summonedIds.length === 0) summonHelpers(entity, creature, summon);
  }

  // The called creatures join the fight at once. They share the threat of the boss, so they attack its target.
  function summonHelpers(boss, bossCreature, { kind, count }) {
    for (let index = 0; index < count; index++) {
      summonCount += 1;
      const angle = (index / count) * 2 * Math.PI;
      const place = {
        x: boss.x + Math.cos(angle) * SUMMON_DISTANCE,
        z: boss.z + Math.sin(angle) * SUMMON_DISTANCE,
        rotation: boss.rotation,
      };
      const helperId = world.addCreature(`${boss.id}-${kind}-${summonCount}`, kind, place).id;
      addCreature(helperId);
      creatures.get(helperId).threat = new Map(bossCreature.threat);
      bossCreature.summonedIds.push(helperId);
    }
  }

  // When a boss resets, its called creatures go away, so that the next attempt starts the same way.
  function dismissHelpers(creature) {
    for (const helperId of creature.summonedIds) {
      combat.removeEntity(helperId);
      world.removeCreature(helperId);
      creatures.delete(helperId);
    }
    creature.summonedIds = [];
  }

  function chooseTarget(creature) {
    let highestId = null;
    let highestThreat = -Infinity;
    for (const [sourceId, threat] of creature.threat) {
      if (threat > highestThreat) {
        highestId = sourceId;
        highestThreat = threat;
      }
    }

    const currentThreat = creature.threat.get(creature.targetId);
    if (currentThreat !== undefined && highestThreat <= currentThreat * TARGET_SWITCH_THREAT_RATIO) {
      return creature.targetId;
    }
    return highestId;
  }

  function wander(entity, creature, elapsedSeconds, now) {
    forgetFight(entity.id, creature);
    if (!creature.wanderPoint) {
      if (now < creature.idleUntil) return;
      creature.wanderPoint = randomPointNear(creature.home, CREATURES[entity.kind].wanderRadius);
    }

    const walkStep = WALK_SPEED * world.movementSpeedFactorAt(entity.x, entity.z) * elapsedSeconds;
    const position = moveToward(entity, creature.wanderPoint, walkStep, 0);
    world.moveCreature(entity.id, position);
    if (position.x === creature.wanderPoint.x && position.z === creature.wanderPoint.z) {
      creature.wanderPoint = null;
      creature.idleUntil = now + IDLE_MS.min + random() * (IDLE_MS.max - IDLE_MS.min);
    }
  }

  // As in WoW, a creature that is pulled too far or that has nobody left to fight runs home.
  // On the way it cannot be hurt and ignores players, and at home it heals to full.
  function startEvading(id, creature) {
    forgetFight(id, creature);
    dismissHelpers(creature);
    creature.wanderPoint = null;
    world.setEvading(id, true);
  }

  function runHome(entity, creature, elapsedSeconds, now) {
    const runStep = RUN_SPEED * world.movementSpeedFactorAt(entity.x, entity.z) * elapsedSeconds;
    const position = moveToward(entity, creature.home, runStep, 0);
    world.moveCreature(entity.id, position);
    if (position.x !== creature.home.x || position.z !== creature.home.z) return;

    world.changeHealth(entity.id, entity.maxHealth);
    world.setEvading(entity.id, false);
    creature.idleUntil = now + IDLE_MS.min + random() * (IDLE_MS.max - IDLE_MS.min);
  }

  function forgetFight(id, creature) {
    creature.threat.clear();
    if (creature.targetId === null) return;
    combat.stopAutoAttack(id);
    creature.targetId = null;
  }

  // A uniform point in the circle needs the square root of the random radius.
  function randomPointNear({ x, z }, wanderRadius) {
    const angle = random() * 2 * Math.PI;
    const distance = Math.sqrt(random()) * wanderRadius;
    return { x: x + Math.sin(angle) * distance, z: z + Math.cos(angle) * distance };
  }

  return { addCreature, handleCombatEvent, tick };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// The creature stops when it gets within the stop distance, and it turns to face the point even when it does not move.
function moveToward(entity, point, maxStep, stopDistance) {
  const toPointX = point.x - entity.x;
  const toPointZ = point.z - entity.z;
  const distance = Math.hypot(toPointX, toPointZ);
  const rotation = distance > 0 ? Math.atan2(toPointX, toPointZ) : entity.rotation;
  const travel = Math.min(maxStep, Math.max(distance - stopDistance, 0));
  if (distance === 0 || travel === distance) return { x: point.x, z: point.z, rotation };

  return {
    x: entity.x + (toPointX / distance) * travel,
    z: entity.z + (toPointZ / distance) * travel,
    rotation,
  };
}
