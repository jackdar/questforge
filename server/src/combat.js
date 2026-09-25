import { SPELLS } from 'questforge-shared/spells.js';
import { chooseSpellTarget, isInRange, isFacing } from 'questforge-shared/spell-rules.js';

export const MANA_REGEN_PER_SECOND = 5;
export const RESPAWN_DELAY_MS = 5000;

export function createCombat(world, emit) {
  const activeCasts = new Map();
  const cooldownReadyTimes = new Map();
  const pendingRespawns = new Map();
  const autoAttacks = new Map();
  let lastTickTime = null;

  function startCast(casterId, spellId, requestedTargetId, now) {
    const spell = Object.hasOwn(SPELLS, spellId) ? SPELLS[spellId] : null;
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
      resolveSpell(casterId, spell, target.id, now);
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

  function removeEntity(entityId) {
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
    resolveSpell(casterId, cast.spell, cast.targetId, now);
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

  function startAutoAttack(casterId, targetId, now) {
    if (autoAttacks.get(casterId)?.targetId === targetId) return;
    autoAttacks.set(casterId, { targetId, nextSwingTime: now });
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

    const spell = SPELLS.autoAttack;
    if (!isInRange(spell, caster, target) || !isFacing(caster, target)) return;

    autoAttack.nextSwingTime = now + spell.swingIntervalMs;
    resolveSpell(casterId, spell, target.id, now);
  }

  function resolveSpell(casterId, spell, targetId, now) {
    world.spendMana(casterId, spell.manaCost);
    if (spell.cooldownMs > 0) setCooldownReadyTime(casterId, spell.id, now + spell.cooldownMs);

    const healthChange = spell.effect === 'damage' ? -spell.amount : spell.amount;
    const targetHealth = world.changeHealth(targetId, healthChange);
    emit({ type: 'spellHit', casterId, targetId, spellId: spell.id, effect: spell.effect, amount: spell.amount });

    if (targetHealth === 0) {
      interruptCast(targetId);
      stopAutoAttack(targetId);
      pendingRespawns.set(targetId, now + RESPAWN_DELAY_MS);
    }
  }

  function cooldownReadyTime(casterId, spellId) {
    return cooldownReadyTimes.get(casterId)?.get(spellId) ?? 0;
  }

  function setCooldownReadyTime(casterId, spellId, readyTime) {
    if (!cooldownReadyTimes.has(casterId)) cooldownReadyTimes.set(casterId, new Map());
    cooldownReadyTimes.get(casterId).set(spellId, readyTime);
  }

  return { startCast, interruptCast, stopAutoAttack, tick, removeEntity };
}

function failure(message) {
  return { ok: false, message };
}
