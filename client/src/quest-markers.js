import * as THREE from 'three';
import { nameplateHeightOf } from './nameplates.js';

// The marker floats above the nameplate.
const HEIGHT_ABOVE_NAMEPLATE = 0.65;
const MAX_VISIBLE_DISTANCE = 60;
// The shop marker is a coin that the page draws, so it has no text.
const MARKER_SYMBOLS = { available: '!', inProgress: '?', turnIn: '?', shop: '' };

export function createQuestMarkers(camera) {
  const layer = document.getElementById('quest-marker-layer');
  const markers = new Map();
  const screenPosition = new THREE.Vector3();

  // Each NPC is { state, position, marker }. The marker is 'available', 'inProgress', 'turnIn', 'shop', or null.
  function update(npcs) {
    const idsWithMarkers = new Set();

    for (const { state, position, marker } of npcs) {
      if (!marker) continue;
      idsWithMarkers.add(state.id);
      const element = markers.get(state.id) ?? addMarker(state.id);
      element.dataset.marker = marker;
      element.textContent = MARKER_SYMBOLS[marker];

      const height = nameplateHeightOf(state) + HEIGHT_ABOVE_NAMEPLATE;
      screenPosition.set(position.x, position.y + height, position.z).project(camera);
      const isBehindCamera = screenPosition.z > 1;
      element.hidden = isBehindCamera || camera.position.distanceTo(position) > MAX_VISIBLE_DISTANCE;
      element.style.left = `${((screenPosition.x + 1) / 2) * window.innerWidth}px`;
      element.style.top = `${((1 - screenPosition.y) / 2) * window.innerHeight}px`;
    }

    for (const [id, element] of markers) {
      if (idsWithMarkers.has(id)) continue;
      element.remove();
      markers.delete(id);
    }
  }

  function addMarker(id) {
    const element = document.createElement('div');
    element.className = 'quest-marker';
    layer.append(element);
    markers.set(id, element);
    return element;
  }

  return { update };
}
