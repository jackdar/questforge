import * as THREE from 'three';

export const SPARKLE_COUNT = 24;
const SPARKLE_COLOR = 0xffe27a;
const SPARKLE_SIZE = 0.12;
const SPARKLE_RADIUS = 0.6;
const SPARKLE_RISE_HEIGHT = 1.4;
const SPARKLE_RISE_SECONDS = 1.6;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Gold sparkles rise from a corpse that the local player can loot. Players who cannot loot it do not see them.
export function createLootSparkles(scene) {
  const sparklesByEntityId = new Map();

  // Each corpse is { state, position }: the server state and the position of its model in the scene.
  function update(corpses, localPlayerId, now) {
    const lootableIds = new Set();
    for (const { state, position } of corpses) {
      if (!localPlayerId || state.health > 0 || !state.lootableBy?.includes(localPlayerId)) continue;
      lootableIds.add(state.id);
      const sparkles = sparklesByEntityId.get(state.id) ?? addSparkles(state.id);
      sparkles.position.copy(position);
      moveSparkles(sparkles, now);
    }

    for (const [entityId, sparkles] of sparklesByEntityId) {
      if (!lootableIds.has(entityId)) removeSparkles(entityId, sparkles);
    }
  }

  function addSparkles(entityId) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKLE_COUNT * 3), 3));
    const material = new THREE.PointsMaterial({
      color: SPARKLE_COLOR,
      size: SPARKLE_SIZE,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sparkles = new THREE.Points(geometry, material);
    scene.add(sparkles);
    sparklesByEntityId.set(entityId, sparkles);
    return sparkles;
  }

  // Every sparkle starts at its own point in the rise, so the column looks continuous instead of pulsing.
  function moveSparkles(sparkles, now) {
    const positions = sparkles.geometry.attributes.position;
    const seconds = now / 1000;
    for (let index = 0; index < SPARKLE_COUNT; index++) {
      const riseProgress = (seconds / SPARKLE_RISE_SECONDS + index / SPARKLE_COUNT) % 1;
      const angle = index * GOLDEN_ANGLE + seconds;
      const radius = SPARKLE_RADIUS * (1 - riseProgress * 0.5);
      positions.setXYZ(index, Math.cos(angle) * radius, riseProgress * SPARKLE_RISE_HEIGHT, Math.sin(angle) * radius);
    }
    positions.needsUpdate = true;
  }

  function removeSparkles(entityId, sparkles) {
    scene.remove(sparkles);
    sparkles.geometry.dispose();
    sparkles.material.dispose();
    sparklesByEntityId.delete(entityId);
  }

  return { update };
}
