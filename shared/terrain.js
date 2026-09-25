export const WORLD_MAX_HEIGHT = 100;

// The ground is flat for now. Terrain can replace this function later, because the client and the server both use it.
export function groundHeightAt(x, z) {
  return 0;
}
