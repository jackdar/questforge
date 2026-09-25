import { SPELLS } from 'questforge-shared/spells.js';
import { chooseSpellTarget, isInRange, isFacing } from 'questforge-shared/spell-rules.js';
import { CREATURES } from 'questforge-shared/creatures.js';
import { levelDamageScale, playerSpellPower } from 'questforge-shared/leveling.js';

export const MANA_REGEN_PER_SECOND = 3;
// A player regains health slowly, and only after a while out of combat. Dealing damage, taking damage, and being on
// the threat list of a creature all count as combat.
export const HEALTH_REGEN_PER_SECOND = 0.5;
export const OUT_OF_COMBAT_DELAY_MS = 15000;
export const RESPAWN_DELAY_MS = 5000;

// In an instance map, such as the cave, a killed creature stays dead. Players always respawn.
export function createCombat(world, emit, { creaturesRespawn = true } = {}) {
  const activeCasts = new Map();
  const cooldownReadyTimes = new Map();
  const pendingRespawns = new Map();
  const autoAttacks = new Map();
  const projectiles = [];
  // Each damage over time is { casterId, targetId, spell, ticksLeft, nextTickAt }. A new one of the same spell on the
  // same target replaces the old one, as in WoW.
  const damageOverTimeEffects = [];
  const lastCombatTimes = new Map();
  // Health is a whole number, so the regeneration saves up the fraction of a point between ticks.
  const healthRegenProgress = new Map();
  let lastTickTime = null;

  function startCast(casterId, spellId, requestedTargetId, now) {
    // Players cannot cast a creature spell such as Bite.
    const spell = Object.hasOwn(SPELLS, spellId) && !SPELLS[spellId].isCreatureOnly ? SPELLS[spellId] : null;
    if (!spell) return failure('That spell does not exist.');

    const caster = world.getEntity(casterId);
    if (!caster) return failure('You are not in the world.');
    if (caster.health === 0) return failure('You cannot cast while dead.');
    if (spell.isAutoAttack) return toggleAutoAttack(spell, caster, requestedTargetId, now);
    if (activeCasts.has(casterId)) return failure('You are already casting.');
    if (now < cooldownReadyTime(casterId, spell.id)) return failure('That spell is not ready yet.');

    const { target, problem: targetProblem } = selectTarget(spell, caster, requestedTargetId);
    if (targetProblem) return failure(targetProblem);

    const problem = findCastProblem(spell, caster, target);
    if (problem) return failure(problem);

    if (spell.castTimeMs === 0) {
      launchSpell(casterId, spell, target.id, now);
      if (spell.startsAutoAttack) startAutoAttack(casterId, target.id, now);
      return { ok: true };
    }

    activeCasts.set(casterId, { spell, targetId: target.id, endsAt: now + spell.castTimeMs });
    emit({ type: 'castStart', casterId, spellId: spell.id, targetId: target.id, durationMs: spell.castTimeMs });
    return { ok: true };
  }

  function interruptCast(casterId) {
    if (activeCasts.delete(casterId)) emit({ type: 'castStop', casterId, reason: 'interrupted' });
  }

  function stopAutoAttack(casterId) {
    if (autoAttacks.delete(casterId)) emit({ type: 'autoAttackStop', casterId });
  }

  function tick(now) {
    const elapsedSeconds = lastTickTime === null ? 0 : (now - lastTickTime) / 1000;
    lastTickTime = now;
    world.regenerateMana(MANA_REGEN_PER_SECOND * elapsedSeconds);
    regenerateHealthOutOfCombat(elapsedSeconds, now);
    moveProjectiles(now);
    tickDamageOverTime(now);

    for (const [casterId, cast] of activeCasts) {
      if (now >= cast.endsAt) completeCast(casterId, cast, now);
    }

    for (const [casterId, autoAttack] of autoAttacks) {
      if (now >= autoAttack.nextSwingTime) trySwing(casterId, autoAttack, now);
    }

    for (const [entityId, respawnTime] of pendingRespawns) {
      if (now < respawnTime) continue;
      pendingRespawns.delete(entityId);
      const entity = world.respawn(entityId);
      if (entity) emit({ type: 'respawn', entityId, x: entity.x, y: entity.y, z: entity.z });
    }
  }

  function regenerateHealthOutOfCombat(elapsedSeconds, now) {
    for (const entity of world.snapshot()) {
      const isHurtPlayer = entity.kind === 'player' && entity.health > 0 && entity.health < entity.maxHealth;
      const isOutOfCombat = now - (lastCombatTimes.get(entity.id) ?? -Infinity) >= OUT_OF_COMBAT_DELAY_MS;
      if (!isHurtPlayer || !isOutOfCombat) {
        healthRegenProgress.delete(entity.id);
        continue;
      }

      const progress = (healthRegenProgress.get(entity.id) ?? 0) + HEALTH_REGEN_PER_SECOND * elapsedSeconds;
      const wholePoints = Math.floor(progress);
      if (wholePoints > 0) world.changeHealth(entity.id, wholePoints);
      healthRegenProgress.set(entity.id, progress - wholePoints);
    }
  }

  function removeEntity(entityId) {
    removeDamageOverTime((effect) => effect.targetId === entityId);
    lastCombatTimes.delete(entityId);
    healthRegenProgress.delete(entityId);
    activeCasts.delete(entityId);
    cooldownReadyTimes.delete(entityId);
    pendingRespawns.delete(entityId);
    autoAttacks.delete(entityId);
  }

  function selectTarget(spell, caster, requestedTargetId) {
    const requestedTarget = requestedTargetId === null ? null : world.getEntity(requestedTargetId);
    const target = chooseSpellTarget(spell, caster, requestedTarget);
    if (target) return { target };
    return { problem: requestedTarget ? 'Invalid target.' : 'You have no target.' };
  }

  // The server checks the target again when a cast finishes, because the target can move or die during the cast.
  function completeCast(casterId, cast, now) {
    activeCasts.delete(casterId);

    const problem = findCastProblem(cast.spell, world.getEntity(casterId), world.getEntity(cast.targetId));
    if (problem) {
      emit({ type: 'castStop', casterId, reason: 'failed', message: problem });
      return;
    }

    emit({ type: 'castStop', casterId, reason: 'completed' });
    launchSpell(casterId, cast.spell, cast.targetId, now);
  }

  function findCastProblem(spell, caster, target) {
    if (!target) return 'Your target is gone.';
    if (target.health === 0) return 'Your target is dead.';
    if (!isInRange(spell, caster, target)) return 'Out of range.';
    if (spell.requiresFacing && !isFacing(caster, target)) return 'You must be facing your target.';
    if (caster.mana < spell.manaCost) return 'Not enough mana.';
    return null;
  }

  function toggleAutoAttack(spell, caster, requestedTargetId, now) {
    if (autoAttacks.has(caster.id)) {
      stopAutoAttack(caster.id);
      return { ok: true };
    }

    const { target, problem } = selectTarget(spell, caster, requestedTargetId);
    if (problem) return failure(problem);
    if (target.health === 0) return failure('Your target is dead.');

    startAutoAttack(caster.id, target.id, now);
    return { ok: true };
  }

  function startAutoAttack(casterId, targetId, now, spellId = 'autoAttack') {
    if (autoAttacks.get(casterId)?.targetId === targetId) return;
    autoAttacks.set(casterId, { targetId, spellId, nextSwingTime: now });
    emit({ type: 'autoAttackStart', casterId, targetId });
  }

  // A target that is out of range or behind the attacker pauses the swings. Auto attack stays on until the target dies.
  function trySwing(casterId, autoAttack, now) {
    const caster = world.getEntity(casterId);
    const target = world.getEntity(autoAttack.targetId);
    if (!caster || caster.health === 0 || !target || target.health === 0) {
      stopAutoAttack(casterId);
      return;
    }

    const spell = SPELLS[autoAttack.spellId];
    if (!isInRange(spell, caster, target) || !isFacing(caster, target)) return;

    autoAttack.nextSwingTime = now + spell.swingIntervalMs;
    launchSpell(casterId, spell, target.id, now);
  }

  // A spell costs its mana and starts its cooldown when it leaves the caster. A melee spell or a heal lands at once.
  // A projectile spell lands only when its projectile reaches the target, so the damage, the threat, and a death
  // all happen when players see the hit.
  function launchSpell(casterId, spell, targetId, now) {
    world.spendMana(casterId, spell.manaCost);
    if (spell.cooldownMs > 0) setCooldownReadyTime(casterId, spell.id, now + spell.cooldownMs);
    emit({ type: 'spellLaunch', casterId, targetId, spellId: spell.id });

    const caster = world.getEntity(casterId);
    if (!spell.projectileSpeed || !caster) {
      landSpell(casterId, spell, targetId, now);
      return;
    }
    projectiles.push({ casterId, targetId, spell, x: caster.x, y: caster.y, z: caster.z, movedAt: now });
  }

  // The client draws the same projectile at the same speed. Both follow the target, so a moving target is hit late.
  function moveProjectiles(now) {
    for (const projectile of [...projectiles]) {
      const target = world.getEntity(projectile.targetId);
      if (!target || target.health === 0) {
        projectiles.splice(projectiles.indexOf(projectile), 1);
        continue;
      }

      const step = (projectile.spell.projectileSpeed * (now - projectile.movedAt)) / 1000;
      projectile.movedAt = now;
      const toTarget = { x: target.x - projectile.x, y: target.y - projectile.y, z: target.z - projectile.z };
      const distance = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
      if (distance <= step) {
        projectiles.splice(projectiles.indexOf(projectile), 1);
        landSpell(projectile.casterId, projectile.spell, projectile.targetId, now);
        continue;
      }

      projectile.x += (toTarget.x / distance) * step;
      projectile.y += (toTarget.y / distance) * step;
      projectile.z += (toTarget.z / distance) * step;
    }
  }

  function markInCombat(entityId, now) {
    lastCombatTimes.set(entityId, now);
  }

  function landSpell(casterId, spell, targetId, now) {
    if (spell.effect === 'damage') {
      markInCombat(casterId, now);
      markInCombat(targetId, now);
    }

    // An evading creature takes no damage. Players see "Evade" instead of a number.
    if (spell.effect === 'damage' && world.getEntity(targetId)?.isEvading) {
      emit({ type: 'spellHit', casterId, targetId, spellId: spell.id, effect: 'evade', amount: 0 });
      return;
    }

    const poweredAmount = spell.amount * spellPowerOf(casterId);
    const amount =
      spell.effect === 'damage' ? scaledDamage(poweredAmount, casterId, targetId) : Math.round(poweredAmount);
    const targetHealth = world.changeHealth(targetId, spell.effect === 'damage' ? -amount : amount);
    emit({ type: 'spellHit', casterId, targetId, spellId: spell.id, effect: spell.effect, amount });

    if (targetHealth === 0) {
      handleDeath(targetId, now);
      return;
    }
    if (spell.damageOverTime) startDamageOverTime(casterId, spell, targetId, now);
  }

  function handleDeath(targetId, now) {
    interruptCast(targetId);
    stopAutoAttack(targetId);
    removeDamageOverTime((effect) => effect.targetId === targetId);
    const creature = CREATURES[world.getEntity(targetId).kind];
    if (creature && !creaturesRespawn) return;
    pendingRespawns.set(targetId, now + (creature?.respawnDelayMs ?? RESPAWN_DELAY_MS));
  }

  function startDamageOverTime(casterId, spell, targetId, now) {
    removeDamageOverTime((effect) => effect.targetId === targetId && effect.spell.id === spell.id);
    const { ticks, intervalMs } = spell.damageOverTime;
    damageOverTimeEffects.push({ casterId, targetId, spell, ticksLeft: ticks, nextTickAt: now + intervalMs });
  }

  // Each tick of a damage over time is a hit of its own, so it shows a number and keeps both sides in combat.
  function tickDamageOverTime(now) {
    for (const effect of [...damageOverTimeEffects]) {
      if (now < effect.nextTickAt) continue;
      const { casterId, targetId, spell } = effect;
      const target = world.getEntity(targetId);
      if (!target || target.health === 0) {
        removeDamageOverTime((candidate) => candidate === effect);
        continue;
      }

      markInCombat(casterId, now);
      markInCombat(targetId, now);
      const poweredAmount = spell.damageOverTime.amount * spellPowerOf(casterId);
      const amount = scaledDamage(poweredAmount, casterId, targetId);
      const targetHealth = world.changeHealth(targetId, -amount);
      emit({ type: 'spellHit', casterId, targetId, spellId: spell.id, effect: 'damage', amount, isPeriodic: true });

      effect.ticksLeft -= 1;
      effect.nextTickAt += spell.damageOverTime.intervalMs;
      if (effect.ticksLeft === 0) removeDamageOverTime((candidate) => candidate === effect);
      if (targetHealth === 0) handleDeath(targetId, now);
    }
  }

  function removeDamageOverTime(shouldRemove) {
    for (let index = damageOverTimeEffects.length - 1; index >= 0; index--) {
      if (shouldRemove(damageOverTimeEffects[index])) damageOverTimeEffects.splice(index, 1);
    }
  }

  // A creature casts an ability, such as Poison Bite, at its target when the ability is ready. A creature never
  // casts a player spell, and a player never casts a creature ability.
  function castCreatureAbility(casterId, spellId, targetId, now) {
    const spell = SPELLS[spellId];
    const caster = world.getEntity(casterId);
    const target = world.getEntity(targetId);
    if (!spell?.isCreatureOnly || !caster || caster.health === 0 || !target || target.health === 0) return false;
    if (now < cooldownReadyTime(casterId, spellId)) return false;
    if (!isInRange(spell, caster, target) || (spell.requiresFacing && !isFacing(caster, target))) return false;

    launchSpell(casterId, spell, targetId, now);
    return true;
  }

  // Only players grow stronger with their level. A caster that left the world casts at base power.
  function spellPowerOf(casterId) {
    const caster = world.getEntity(casterId);
    return caster?.kind === 'player' ? playerSpellPower(caster.level) : 1;
  }

  // A caster that left the world while its projectile flew deals the damage without a level gap.
  function scaledDamage(amount, casterId, targetId) {
    const caster = world.getEntity(casterId);
    const target = world.getEntity(targetId);
    if (!caster || !target) return Math.round(amount);
    return Math.round(amount * levelDamageScale(caster.level, target.level));
  }

  function cooldownReadyTime(casterId, spellId) {
    return cooldownReadyTimes.get(casterId)?.get(spellId) ?? 0;
  }

  function setCooldownReadyTime(casterId, spellId, readyTime) {
    if (!cooldownReadyTimes.has(casterId)) cooldownReadyTimes.set(casterId, new Map());
    cooldownReadyTimes.get(casterId).set(spellId, readyTime);
  }

  return {
    startCast,
    castCreatureAbility,
    interruptCast,
    startAutoAttack,
    stopAutoAttack,
    markInCombat,
    tick,
    removeEntity,
  };
}

function failure(message) {
  return { ok: false, message };
}
