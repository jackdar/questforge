// A spider steps in two groups of four legs, as real spiders do: while one group steps forward, the other pushes
// back. The legs step faster as the spider moves faster.
export const STRIDE_LENGTH = 0.9;
export const LEG_SWING_ANGLE = 0.35;
export const BITE_DURATION_MS = 300;
export const BITE_HEAD_ANGLE = 0.5;
const MOVING_SPEED_THRESHOLD = 0.2;
const REST_SMOOTHING = 12;

export function createSpiderAnimator(parts) {
  let stridePhase = 0;
  let biteStartedAt = null;

  function bite(now) {
    biteStartedAt = now;
  }

  function update(now, deltaSeconds, { speed }) {
    const isMoving = speed > MOVING_SPEED_THRESHOLD;
    stridePhase = isMoving ? (stridePhase + (speed / STRIDE_LENGTH) * deltaSeconds * 2 * Math.PI) % (2 * Math.PI) : 0;
    const blend = 1 - Math.exp(-REST_SMOOTHING * deltaSeconds);

    parts.legs.forEach((leg, index) => {
      const rest = leg.userData.restRotationY;
      const group = index % 2 === 0 ? 1 : -1;
      if (isMoving) leg.rotation.y = rest + Math.sin(stridePhase) * LEG_SWING_ANGLE * group;
      else leg.rotation.y += (rest - leg.rotation.y) * blend;
    });
    parts.head.rotation.x = biteHeadAngle(now);
  }

  // The head lunges down and forward, then comes back up.
  function biteHeadAngle(now) {
    if (biteStartedAt === null) return 0;
    const progress = (now - biteStartedAt) / BITE_DURATION_MS;
    if (progress >= 1) {
      biteStartedAt = null;
      return 0;
    }
    return Math.sin(progress * Math.PI) * BITE_HEAD_ANGLE;
  }

  return { bite, update };
}
