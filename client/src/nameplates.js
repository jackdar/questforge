import * as THREE from 'three';
import { displayRelationship } from './relationship-display.js';
import { CREATURES } from 'questforge-shared/creatures.js';
import { showLevel } from './level-label.js';
import { doRectanglesOverlap, screenOutlineOf } from './screen-outline.js';

const NAMEPLATE_HEIGHT = 2.45;
// A shorter model has a lower nameplate. An NPC is keyed by its appearance, and anything else by its kind.
const NAMEPLATE_HEIGHTS_BY_MODEL = {
  wolf: 1.6,
  alphaWolf: 2.1,
  dwarf: 2,
  banditLeader: 2.7,
  giantSpider: 1.8,
  spiderling: 1,
  broodmother: 3.8,
};

export function nameplateHeightOf(state) {
  const model = state.appearance ?? CREATURES[state.kind]?.model ?? state.kind;
  return NAMEPLATE_HEIGHTS_BY_MODEL[model] ?? NAMEPLATE_HEIGHT;
}
const MAX_VISIBLE_DISTANCE = 60;

export function createNameplates(camera, interfaceSettings) {
  const layer = document.getElementById('nameplate-layer');
  const nameplates = new Map();
  const screenPosition = new THREE.Vector3();

  // Each character is { state, position }: the server state and the position of its model in the scene.
  // The own character model hides the nameplates of units behind it, so that no nameplate covers it.
  function update(characters, viewer, targetId, playerMesh) {
    const idsOnScreen = new Set();
    const behindPlayer = [];

    for (const { state, position } of characters) {
      idsOnScreen.add(state.id);
      const element = nameplates.get(state.id) ?? addNameplate(state.id);
      const relationship = viewer ? displayRelationship(viewer, state) : 'hostile';
      element.dataset.relationship = relationship;
      showText(element.querySelector('.nameplate-name'), state.name);
      const showsDifficulty = relationship === 'hostile' || relationship === 'neutral';
      showLevel(element.querySelector('.nameplate-level'), state.level, showsDifficulty ? viewer : null);

      const height = nameplateHeightOf(state);
      screenPosition.set(position.x, position.y + height, position.z).project(camera);
      const isBehindCamera = screenPosition.z > 1;
      const isTooFar = camera.position.distanceTo(position) > MAX_VISIBLE_DISTANCE;
      const isShown = isNameplateShown(state.id, viewer?.id, targetId);
      element.hidden = !isShown || isBehindCamera || isTooFar;
      element.style.left = `${((screenPosition.x + 1) / 2) * window.innerWidth}px`;
      element.style.top = `${((1 - screenPosition.y) / 2) * window.innerHeight}px`;

      const isOwnNameplate = state.id === viewer?.id;
      const distanceToPlayer = camera.position.distanceTo(playerMesh.position);
      const isFartherThanPlayer = camera.position.distanceTo(position) > distanceToPlayer;
      if (!element.hidden && !isOwnNameplate && viewer && isFartherThanPlayer) behindPlayer.push(element);
    }

    hideNameplatesCoveringPlayer(behindPlayer, playerMesh);

    for (const [id, element] of nameplates) {
      if (idsOnScreen.has(id)) continue;
      element.remove();
      nameplates.delete(id);
    }
  }

  function addNameplate(id) {
    const element = document.createElement('div');
    element.className = 'nameplate';
    const level = document.createElement('span');
    level.className = 'nameplate-level';
    const name = document.createElement('span');
    name.className = 'nameplate-name';
    element.append(level, name);
    layer.append(element);
    nameplates.set(id, element);
    return element;
  }

  // All positions are written before any size is read, so the browser lays out the page only once each frame.
  function hideNameplatesCoveringPlayer(elements, playerMesh) {
    if (elements.length === 0) return;
    const playerOutline = screenOutlineOf(playerMesh, camera, { width: window.innerWidth, height: window.innerHeight });
    if (!playerOutline) return;
    for (const element of elements) {
      if (doRectanglesOverlap(element.getBoundingClientRect(), playerOutline)) element.hidden = true;
    }
  }

  // The own nameplate has its own setting. Any other unit shows when it is the target or when all nameplates show.
  function isNameplateShown(entityId, viewerId, targetId) {
    if (entityId === viewerId) return interfaceSettings.get('showOwnNameplate');
    return interfaceSettings.get('showAllNameplates') || entityId === targetId;
  }

  return { update };
}


// The nameplates update every frame, so the text changes only when it is different.
function showText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
