// One stride is a full cycle of the legs. The legs cycle faster as the wolf moves faster.
export const STRIDE_LENGTH = 1.4;
export const WALK_LEG_ANGLE = 0.4;
export const RUN_LEG_ANGLE = 0.9;
export const RUN_SPEED_THRESHOLD = 4;
export const BITE_DURATION_MS = 300;
export const BITE_HEAD_ANGLE = 0.6;
const MOVING_SPEED_THRESHOLD = 0.2;
const REST_SMOOTHING = 12;
const TAIL_WAG_ANGLE = 0.25;

export function createWolfAnimator(parts) {
  let stridePhase = 0;
  let biteStartedAt = null;

  function bite(now) {
    biteStartedAt = now;
  }

  // A trot moves each diagonal pair of legs together, as a real wolf does.
  function update(now, deltaSeconds, { speed }) {
    const isMoving = speed > MOVING_SPEED_THRESHOLD;
    stridePhase = isMoving ? (stridePhase + (speed / STRIDE_LENGTH) * deltaSeconds * 2 * Math.PI) % (2 * Math.PI) : 0;
    const legAngle = speed >= RUN_SPEED_THRESHOLD ? RUN_LEG_ANGLE : WALK_LEG_ANGLE;
    const swing = Math.sin(stridePhase) * legAngle;

    const blend = 1 - Math.exp(-REST_SMOOTHING * deltaSeconds);
    for (const [leg, direction] of [
      [parts.frontLeftLeg, 1],
      [parts.backRightLeg, 1],
      [parts.frontRightLeg, -1],
      [parts.backLeftLeg, -1],
    ]) {
      if (isMoving) leg.rotation.x = swing * direction;
      else leg.rotation.x += (0 - leg.rotation.x) * blend;
    }

    parts.tail.rotation.y = isMoving ? Math.sin(stridePhase * 2) * TAIL_WAG_ANGLE : 0;
    parts.head.rotation.x = biteHeadAngle(now);
  }

  // The head snaps down and forward, then comes back up.
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
