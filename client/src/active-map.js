import { MAPS } from 'questforge-shared/maps.js';

// The map that the local player is on. Walking, the camera, and the other characters all stand on its terrain.
let activeMap = MAPS.overworld;

export function setActiveMap(mapId) {
  activeMap = MAPS[mapId];
}

export function activeMapId() {
  return activeMap.id;
}

export function activeTerrain() {
  return activeMap.terrain;
}
