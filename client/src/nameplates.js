import * as THREE from 'three';
import { getRelationship } from 'questforge-shared/factions.js';

const NAMEPLATE_HEIGHT = 2.45;
const MAX_VISIBLE_DISTANCE = 60;

export function createNameplates(camera) {
  const layer = document.getElementById('nameplate-layer');
  const nameplates = new Map();
  const screenPosition = new THREE.Vector3();

  // Each character is { state, position }: the server state and the position of its model in the scene.
  function update(characters, viewer) {
    const idsOnScreen = new Set();

    for (const { state, position } of characters) {
      idsOnScreen.add(state.id);
      const element = nameplates.get(state.id) ?? addNameplate(state.id);
      if (element.textContent !== state.name) element.textContent = state.name;
      element.dataset.relationship = viewer ? getRelationship(viewer, state) : 'hostile';

      screenPosition.set(position.x, position.y + NAMEPLATE_HEIGHT, position.z).project(camera);
      const isBehindCamera = screenPosition.z > 1;
      const isTooFar = camera.position.distanceTo(position) > MAX_VISIBLE_DISTANCE;
      element.hidden = isBehindCamera || isTooFar;
      element.style.left = `${((screenPosition.x + 1) / 2) * window.innerWidth}px`;
      element.style.top = `${((1 - screenPosition.y) / 2) * window.innerHeight}px`;
    }

    for (const [id, element] of nameplates) {
      if (idsOnScreen.has(id)) continue;
      element.remove();
      nameplates.delete(id);
    }
  }

  function addNameplate(id) {
    const element = document.createElement('div');
    element.className = 'nameplate';
    layer.append(element);
    nameplates.set(id, element);
    return element;
  }

  return { update };
}
