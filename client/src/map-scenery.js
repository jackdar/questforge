import { createOverworldScenery } from './world.js';
import { createCaveScenery } from './cave-scenery.js';

const SCENERY_BY_MAP = {
  overworld: createOverworldScenery,
  spiderCave: createCaveScenery,
};

// Builds the scenery of a map. Dispose takes it out of the scene and frees its geometry and materials, so that the
// next map starts clean.
export function createMapScenery(mapId, scene) {
  const scenery = SCENERY_BY_MAP[mapId](scene);

  function dispose() {
    scene.remove(scenery.root);
    scenery.root.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
  }

  return { update: scenery.update, dispose };
}
