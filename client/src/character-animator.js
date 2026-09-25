import * as THREE from 'three';

export const SWING_DURATION_MS = 350;
export const CAST_RELEASE_MS = 250;
export const CAST_ARM_ANGLE = -1.3;
export const LANDING_MS = 180;
export const AIR_LEG_ANGLES = { left: -0.6, right: 0.35 };
export const SWING_STYLES = {
  light: { from: -2.9, to: -0.6 },
  heavy: { from: -3.5, to: -0.3 },
};

const RELEASE_ARM_ANGLE = -1.75;
const WALK_CYCLE_RADIANS_PER_SECOND = 9;
const LEG_SWING = 0.6;
const ARM_WALK_SWING = 0.4;
const POSE_SMOOTHING = 15;
const BREATH_RADIANS_PER_MS = 0.002;
const BREATH_HEIGHT = 0.015;
const HAND_GLOW_INTENSITY = 1.5;
const AIR_ARM_ANGLE = -0.5;
const LANDING_DIP = 0.12;

// A negative rotation around x raises a limb forward: -PI/2 points it straight ahead, -PI points it up.
export function createCharacterAnimator(parts) {
  let castColor = null;
  let releaseStartedAt = -Infinity;
  let activeSwing = null;
  let walkPhase = 0;
  let landedAt = -Infinity;

  function startCast(color) {
    castColor = new THREE.Color(color);
  }

  function stopCast({ completed }, now) {
    castColor = null;
    if (completed) release(now);
  }

  function release(now) {
    releaseStartedAt = now;
  }

  function land(now) {
    landedAt = now;
  }

  function swing(style, now) {
    activeSwing = { ...SWING_STYLES[style], startedAt: now };
  }

  function update(now, deltaSeconds, { isMoving = false, isAirborne = false } = {}) {
    const blend = 1 - Math.exp(-POSE_SMOOTHING * deltaSeconds);
    if (isMoving) walkPhase += WALK_CYCLE_RADIANS_PER_SECOND * deltaSeconds;
    const stride = isMoving ? Math.sin(walkPhase) : 0;

    approachRotation(parts.leftLeg, isAirborne ? AIR_LEG_ANGLES.left : stride * LEG_SWING, blend);
    approachRotation(parts.rightLeg, isAirborne ? AIR_LEG_ANGLES.right : -stride * LEG_SWING, blend);

    const castingArmAngle = castingArmAngleAt(now);
    const idleArmAngle = isAirborne ? AIR_ARM_ANGLE : null;
    approachRotation(parts.leftArm, castingArmAngle ?? idleArmAngle ?? -stride * ARM_WALK_SWING, blend);

    const swingArmAngle = swingArmAngleAt(now);
    if (swingArmAngle === null) {
      approachRotation(parts.rightArm, castingArmAngle ?? idleArmAngle ?? stride * ARM_WALK_SWING, blend);
    } else {
      parts.rightArm.rotation.x = swingArmAngle;
    }

    parts.body.position.y = landingOffsetAt(now);
    parts.upperBody.position.y = Math.sin(now * BREATH_RADIANS_PER_MS) * BREATH_HEIGHT;
    setHandGlow(parts.leftHand);
    setHandGlow(parts.rightHand);
  }

  function castingArmAngleAt(now) {
    if (castColor) return CAST_ARM_ANGLE;
    if (now - releaseStartedAt < CAST_RELEASE_MS) return RELEASE_ARM_ANGLE;
    return null;
  }

  function swingArmAngleAt(now) {
    if (!activeSwing) return null;

    const progress = (now - activeSwing.startedAt) / SWING_DURATION_MS;
    if (progress >= 1) {
      activeSwing = null;
      return null;
    }

    const easedProgress = 1 - (1 - progress) ** 3;
    return THREE.MathUtils.lerp(activeSwing.from, activeSwing.to, easedProgress);
  }

  function landingOffsetAt(now) {
    const progress = (now - landedAt) / LANDING_MS;
    if (progress < 0 || progress >= 1) return 0;
    return -LANDING_DIP * Math.sin(Math.PI * progress);
  }

  function setHandGlow(hand) {
    hand.material.emissive.set(castColor ?? 0x000000);
    hand.material.emissiveIntensity = castColor ? HAND_GLOW_INTENSITY : 0;
  }

  return { startCast, stopCast, release, swing, land, update };
}

function approachRotation(limb, targetAngle, blend) {
  limb.rotation.x += (targetAngle - limb.rotation.x) * blend;
}
