import * as THREE from 'three';

const PROJECTILE_SPEED = 30;
const PROJECTILE_HEIGHT = 1.5;
const FLOATING_TEXT_HEIGHT = 2.5;
const FLOATING_TEXT_RISE = 1.5;
const FLOATING_TEXT_DURATION_MS = 1000;
// Numbers that land on one target at about the same time, such as Strike and the first Auto Attack swing,
// go side by side in these screen offsets instead of on top of each other.
const FLOATING_TEXT_OFFSETS_PX = [0, 32, -32, 64, -64];
const FLOATING_TEXT_GROUP_MS = 400;
const PROJECTILE_COLORS = {
  firebolt: 0xff7a1a,
  iceLance: 0x7ad7ff,
};

export function createSpellEffects({ scene, camera, getEntityPosition }) {
  const textLayer = document.getElementById('floating-text-layer');
  const projectileGeometry = new THREE.SphereGeometry(0.25, 12, 8);
  const projectiles = [];
  const floatingTexts = [];

  // The server applies the effect at once. The projectile is only a visual, so the health bar can drop before it arrives.
  function showSpellHit({ casterId, targetId, spellId, effect, amount }, now) {
    const casterPosition = getEntityPosition(casterId);
    const targetPosition = getEntityPosition(targetId);
    if (!targetPosition) return;

    const text = effect === 'heal' ? `+${amount}` : `-${amount}`;
    const projectileColor = PROJECTILE_COLORS[spellId];
    if (!projectileColor || !casterPosition) {
      addFloatingText(targetId, targetPosition, text, effect, now);
      return;
    }

    const mesh = new THREE.Mesh(projectileGeometry, new THREE.MeshBasicMaterial({ color: projectileColor }));
    mesh.position.set(casterPosition.x, casterPosition.y + PROJECTILE_HEIGHT, casterPosition.z);
    scene.add(mesh);
    projectiles.push({ mesh, targetId, text, effect });
  }

  function addFloatingText(targetId, position, text, effect, now) {
    const element = document.createElement('div');
    element.className = `floating-text ${effect}`;
    element.textContent = text;
    textLayer.append(element);
    const recentTextsOnTarget = floatingTexts.filter(
      (floatingText) => floatingText.targetId === targetId && now - floatingText.startedAt < FLOATING_TEXT_GROUP_MS,
    ).length;
    const offsetPx = FLOATING_TEXT_OFFSETS_PX[recentTextsOnTarget % FLOATING_TEXT_OFFSETS_PX.length];
    floatingTexts.push({ element, targetId, offsetPx, origin: position.clone(), startedAt: now });
  }

  function update(deltaSeconds, now) {
    updateProjectiles(deltaSeconds, now);
    updateFloatingTexts(now);
  }

  function updateProjectiles(deltaSeconds, now) {
    for (const projectile of [...projectiles]) {
      const targetPosition = getEntityPosition(projectile.targetId);
      if (!targetPosition) {
        removeProjectile(projectile);
        continue;
      }

      const aimPoint = new THREE.Vector3(targetPosition.x, targetPosition.y + PROJECTILE_HEIGHT, targetPosition.z);
      const toTarget = aimPoint.sub(projectile.mesh.position);
      const step = PROJECTILE_SPEED * deltaSeconds;

      if (toTarget.length() <= step) {
        removeProjectile(projectile);
        addFloatingText(projectile.targetId, targetPosition, projectile.text, projectile.effect, now);
      } else {
        projectile.mesh.position.addScaledVector(toTarget.normalize(), step);
      }
    }
  }

  function removeProjectile(projectile) {
    scene.remove(projectile.mesh);
    projectile.mesh.material.dispose();
    projectiles.splice(projectiles.indexOf(projectile), 1);
  }

  function updateFloatingTexts(now) {
    for (const floatingText of [...floatingTexts]) {
      const progress = (now - floatingText.startedAt) / FLOATING_TEXT_DURATION_MS;
      if (progress >= 1) {
        floatingText.element.remove();
        floatingTexts.splice(floatingTexts.indexOf(floatingText), 1);
        continue;
      }

      const screenPosition = floatingText.origin.clone();
      screenPosition.y += FLOATING_TEXT_HEIGHT + FLOATING_TEXT_RISE * progress;
      screenPosition.project(camera);

      const isBehindCamera = screenPosition.z > 1;
      floatingText.element.hidden = isBehindCamera;
      floatingText.element.style.left = `${((screenPosition.x + 1) / 2) * window.innerWidth + floatingText.offsetPx}px`;
      floatingText.element.style.top = `${((1 - screenPosition.y) / 2) * window.innerHeight}px`;
      floatingText.element.style.opacity = String(1 - progress);
    }
  }

  return { showSpellHit, update };
}
