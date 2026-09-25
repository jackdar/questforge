import * as THREE from 'three';
import { getRelationship } from 'questforge-shared/factions.js';
import { activeTerrain } from './active-map.js';
import { isTypingInFormField } from './keyboard.js';
import { screenOutlineOf } from './screen-outline.js';

const CLICK_MOVE_TOLERANCE_PX = 5;
const TAB_TARGET_RANGE = 40;
const CLICK_MARGIN_PX = 16;

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export function createTargeting({ scene, camera, domElement, network, playerMesh, onTargetChange, onInteract }) {
  const raycaster = new THREE.Raycaster();
  const ring = createTargetRing();
  scene.add(ring);

  let targetId = null;
  let pointerDown = null;

  domElement.addEventListener('pointerdown', (event) => {
    if (event.button === LEFT_BUTTON || event.button === RIGHT_BUTTON) {
      pointerDown = { button: event.button, x: event.clientX, y: event.clientY };
    }
  });

  // Dragging turns the camera or the character, so only a click without movement acts.
  // As in WoW, a left click selects a target, and a right click also interacts with it, for example to loot it.
  domElement.addEventListener('pointerup', (event) => {
    if (!pointerDown || event.button !== pointerDown.button) return;
    const distanceMoved = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
    pointerDown = null;
    if (distanceMoved > CLICK_MOVE_TOLERANCE_PX) return;

    const entityId = pickEntityAt(event.clientX, event.clientY);
    if (event.button === LEFT_BUTTON) {
      setTarget(entityId);
    } else if (entityId) {
      setTarget(entityId);
      onInteract(entityId);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (isTypingInFormField(event)) return;
    if (event.code === 'Tab') {
      event.preventDefault();
      setTarget(nextTabTarget() ?? targetId);
    }
    if (event.code === 'F1') {
      event.preventDefault();
      targetSelf();
    }
  });

  function setTarget(newTargetId) {
    if (newTargetId === targetId) return;
    targetId = newTargetId;
    onTargetChange();
  }

  function targetSelf() {
    setTarget(network.getLocalPlayerId());
  }

  function pickEntityAt(clientX, clientY) {
    const bounds = domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);

    const otherCharacters = network.getRemoteEntities().map((entity) => entity.mesh);
    const [closestHit] = raycaster.intersectObjects([playerMesh, ...otherCharacters], true);
    if (closestHit) return findEntityId(closestHit.object);

    return pickCharacterNear(clientX - bounds.left, clientY - bounds.top, bounds, otherCharacters);
  }

  // A click that misses every model still selects a character when it lands within CLICK_MARGIN_PX of the
  // character's outline on screen. The margin is in pixels, so it feels the same for near and far characters.
  // The own character is left out, because it stands in the middle of the screen and would catch clicks on the ground.
  function pickCharacterNear(x, y, bounds, characters) {
    let closest = null;

    for (const character of characters) {
      const outline = screenOutlineOf(character, camera, bounds);
      if (!outline) continue;

      const isNear =
        x >= outline.left - CLICK_MARGIN_PX &&
        x <= outline.right + CLICK_MARGIN_PX &&
        y >= outline.top - CLICK_MARGIN_PX &&
        y <= outline.bottom + CLICK_MARGIN_PX;
      if (!isNear) continue;

      // When the margins of two characters overlap, the character nearer the camera is in front, so it wins.
      const distance = camera.position.distanceTo(character.position);
      if (!closest || distance < closest.distance) closest = { character, distance };
    }

    return closest ? findEntityId(closest.character) : null;
  }

  function nextTabTarget() {
    const localPlayer = network.getLocalPlayer();
    if (!localPlayer) return null;
    const cameraForward = camera.getWorldDirection(new THREE.Vector3());

    const candidates = network
      .getRemoteEntities()
      .filter(({ state }) => getRelationship(localPlayer, state) === 'hostile')
      .map(({ mesh, state }) => ({
        id: state.id,
        distance: mesh.position.distanceTo(playerMesh.position),
        isInFront: mesh.position.clone().sub(camera.position).dot(cameraForward) > 0,
      }))
      .filter((candidate) => candidate.isInFront && candidate.distance <= TAB_TARGET_RANGE)
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) return null;

    const currentIndex = candidates.findIndex((candidate) => candidate.id === targetId);
    return candidates[(currentIndex + 1) % candidates.length].id;
  }

  function getTarget() {
    if (targetId === null) return null;

    const localPlayer = network.getLocalPlayer();
    if (targetId === localPlayer?.id) return { mesh: playerMesh, state: localPlayer };
    return network.getRemoteEntity(targetId) ?? null;
  }

  function update() {
    const target = getTarget();
    if (!target) setTarget(null);

    ring.visible = Boolean(target);
    if (!target) return;
    const { x, z } = target.mesh.position;
    // The ring stays on the ground under a target that jumps.
    ring.position.set(x, activeTerrain().groundHeightAt(x, z) + 0.05, z);
  }

  function clearTarget() {
    setTarget(null);
  }

  return { update, getTarget, targetSelf, clearTarget };
}

function createTargetRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  return ring;
}

function findEntityId(object) {
  let current = object;
  while (current && current.userData.entityId === undefined) current = current.parent;
  return current?.userData.entityId ?? null;
}
