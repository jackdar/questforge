import { getRelationship } from './factions.js';

// A spell that can target the caster falls back to the caster when the requested target is missing or not valid.
export function chooseSpellTarget(spell, caster, requestedTarget) {
  if (requestedTarget && spell.validTargets.includes(getRelationship(caster, requestedTarget))) {
    return requestedTarget;
  }
  return spell.validTargets.includes('self') ? caster : null;
}

// Range counts height, so a target on a ledge above the caster can be out of range.
export function isInRange(spell, caster, target) {
  return Math.hypot(target.x - caster.x, target.y - caster.y, target.z - caster.z) <= spell.maxRange;
}

// The front half of the caster counts as facing. A rotation of 0 faces the +z direction.
export function isFacing(caster, target) {
  const toTargetX = target.x - caster.x;
  const toTargetZ = target.z - caster.z;
  return toTargetX * Math.sin(caster.rotation) + toTargetZ * Math.cos(caster.rotation) >= 0;
}
