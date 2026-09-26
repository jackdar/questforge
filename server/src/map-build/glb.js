// Reads the parts of a binary glTF (.glb) file that the map build needs: the JSON description, the binary data,
// the positions and triangles of a mesh, and the transform of a node in the world.
// The format is described in the glTF 2.0 specification, section "GLB File Format Specification".
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;
const COMPONENT_READERS = {
  5121: { size: 1, read: (view, offset) => view.getUint8(offset) },
  5123: { size: 2, read: (view, offset) => view.getUint16(offset, true) },
  5125: { size: 4, read: (view, offset) => view.getUint32(offset, true) },
  5126: { size: 4, read: (view, offset) => view.getFloat32(offset, true) },
};
const TYPE_SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('The file is not a binary glTF (.glb) file.');

  let json = null;
  let binary = null;
  for (let offset = 12; offset < view.byteLength; ) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunk = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (chunkType === JSON_CHUNK) json = JSON.parse(new TextDecoder().decode(chunk));
    if (chunkType === BINARY_CHUNK) binary = chunk;
    offset += 8 + chunkLength;
  }
  if (!json) throw new Error('The .glb file has no JSON chunk.');
  return { json, binary };
}

// Returns the values of an accessor as a flat array, for example x, y, z, x, y, z for positions.
export function readAccessor({ json, binary }, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const reader = COMPONENT_READERS[accessor.componentType];
  if (!reader) throw new Error(`The map build cannot read accessor component type ${accessor.componentType}.`);
  const componentCount = TYPE_SIZES[accessor.type];
  const stride = bufferView.byteStride ?? reader.size * componentCount;
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

  const values = new Array(accessor.count * componentCount);
  for (let item = 0; item < accessor.count; item++) {
    for (let component = 0; component < componentCount; component++) {
      values[item * componentCount + component] = reader.read(view, start + item * stride + component * reader.size);
    }
  }
  return values;
}

// Finds a node by name in the default scene, with the world transform that its parents give it.
export function findNodeInWorld({ json }, name) {
  const scene = json.scenes[json.scene ?? 0];
  const search = (nodeIndex, parentMatrix) => {
    const node = json.nodes[nodeIndex];
    const worldMatrix = multiplyMatrices(parentMatrix, localMatrixOf(node));
    if (node.name === name) return { node, worldMatrix };
    for (const childIndex of node.children ?? []) {
      const found = search(childIndex, worldMatrix);
      if (found) return found;
    }
    return null;
  };
  for (const rootIndex of scene.nodes ?? []) {
    const found = search(rootIndex, IDENTITY);
    if (found) return found;
  }
  return null;
}

// Returns the triangles of every primitive of the mesh, as world positions: x, y, z for each corner.
export function readMeshTrianglesInWorld(glb, mesh, worldMatrix) {
  const triangles = [];
  for (const primitive of mesh.primitives) {
    if (primitive.mode !== undefined && primitive.mode !== 4) continue;
    const positions = readAccessor(glb, primitive.attributes.POSITION);
    const world = new Float64Array(positions.length);
    for (let index = 0; index < positions.length; index += 3) {
      const [x, y, z] = transformPoint(worldMatrix, positions[index], positions[index + 1], positions[index + 2]);
      world[index] = x;
      world[index + 1] = y;
      world[index + 2] = z;
    }
    const indices =
      primitive.indices === undefined
        ? Array.from({ length: positions.length / 3 }, (_, index) => index)
        : readAccessor(glb, primitive.indices);
    triangles.push({ positions: world, indices });
  }
  return triangles;
}

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// glTF matrices are column-major: the translation is in elements 12, 13, and 14.
function localMatrixOf(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (qy * qy + qz * qz)) * sx,
    2 * (qx * qy + qz * qw) * sx,
    2 * (qx * qz - qy * qw) * sx,
    0,
    2 * (qx * qy - qz * qw) * sy,
    (1 - 2 * (qx * qx + qz * qz)) * sy,
    2 * (qy * qz + qx * qw) * sy,
    0,
    2 * (qx * qz + qy * qw) * sz,
    2 * (qy * qz - qx * qw) * sz,
    (1 - 2 * (qx * qx + qy * qy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) result[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
    }
  }
  return result;
}

function transformPoint(m, x, y, z) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}
