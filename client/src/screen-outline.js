import * as THREE from 'three';

const BOX_CORNERS = [0, 1].flatMap((x) => [0, 1].flatMap((y) => [0, 1].map((z) => [x, y, z])));
const boundingBox = new THREE.Box3();
const corner = new THREE.Vector3();

// The screen rectangle around the 3D bounding box of an object, in pixels of a view of the given size.
// It is null when the object has no size or when part of it is behind the camera.
export function screenOutlineOf(object, camera, { width, height }) {
  boundingBox.setFromObject(object);
  if (boundingBox.isEmpty()) return null;

  const outline = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const [useMaxX, useMaxY, useMaxZ] of BOX_CORNERS) {
    corner
      .set(
        useMaxX ? boundingBox.max.x : boundingBox.min.x,
        useMaxY ? boundingBox.max.y : boundingBox.min.y,
        useMaxZ ? boundingBox.max.z : boundingBox.min.z,
      )
      .project(camera);
    if (corner.z > 1) return null;

    const screenX = ((corner.x + 1) / 2) * width;
    const screenY = ((1 - corner.y) / 2) * height;
    outline.left = Math.min(outline.left, screenX);
    outline.right = Math.max(outline.right, screenX);
    outline.top = Math.min(outline.top, screenY);
    outline.bottom = Math.max(outline.bottom, screenY);
  }
  return outline;
}

export function doRectanglesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
