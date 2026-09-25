import * as THREE from 'three';

const HIP_HEIGHT = 0.9;
const SHOULDER_HEIGHT = 1.55;
const SHOULDER_OFFSET = 0.4;
const HIP_OFFSET = 0.15;
const HEAD_HEIGHT = 1.83;
const LEATHER_COLOR = 0x5a3d24;
// A model faces +z, so its right side is at -x and its left side is at +x.
const LEFT_SIDE = 1;
const RIGHT_SIDE = -1;

const PALETTES = {
  dawnguard: { armor: 0xb8c0cc, cloth: 0x2a5db0, trim: 0xd4af37, helmet: 0xc9d0da },
  emberclaw: { armor: 0x3a3232, cloth: 0xa8281c, trim: 0x8a8a8a, helmet: 0x2e2626 },
};

const APPEARANCE_DETAILS = {
  dawnguard: addDawnguardDetails,
  emberclaw: addEmberclawDetails,
};

// The model origin is at the feet. A rotation of 0 faces the +z direction.
export function createCharacterModel(appearance) {
  if (appearance === 'dummy') return createDummyModel();

  const palette = PALETTES[appearance];
  if (!palette) throw new Error(`No character model exists for "${appearance}". Add one to PALETTES.`);

  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const upperBody = new THREE.Group();
  upperBody.add(
    createPart(new THREE.BoxGeometry(0.6, 0.7, 0.35), palette.armor, [0, 1.25, 0]),
    createPart(new THREE.BoxGeometry(0.5, 0.8, 0.05), palette.cloth, [0, 1.15, 0.19]),
    createPart(new THREE.BoxGeometry(0.62, 0.08, 0.37), palette.trim, [0, 0.93, 0]),
    createPart(new THREE.SphereGeometry(0.21, 16, 12), palette.helmet, [0, HEAD_HEIGHT, 0]),
    createPart(new THREE.BoxGeometry(0.26, 0.06, 0.05), 0x111111, [0, HEAD_HEIGHT, 0.19]),
  );

  const leftArm = createArm(palette, LEFT_SIDE);
  const rightArm = createArm(palette, RIGHT_SIDE);
  rightArm.hand.add(createSword());
  upperBody.add(leftArm.pivot, rightArm.pivot);

  const leftLeg = createLeg(palette, LEFT_SIDE);
  const rightLeg = createLeg(palette, RIGHT_SIDE);
  // The body group holds everything above the feet, so that the animator can move it for a landing.
  const body = new THREE.Group();
  body.add(upperBody, leftLeg, rightLeg);
  root.add(body);

  APPEARANCE_DETAILS[appearance]({ palette, upperBody, leftArm: leftArm.pivot });
  enableShadows(root);

  return {
    root,
    parts: {
      body,
      upperBody,
      leftArm: leftArm.pivot,
      rightArm: rightArm.pivot,
      leftHand: leftArm.hand,
      rightHand: rightArm.hand,
      leftLeg,
      rightLeg,
    },
  };
}

export function disposeCharacterModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
}

function createPart(geometry, color, [x, y, z], materialOptions = {}) {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, ...materialOptions }));
  mesh.position.set(x, y, z);
  return mesh;
}

// Each arm turns around a pivot at the shoulder, so that the animator can rotate the whole arm.
function createArm(palette, side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * SHOULDER_OFFSET, SHOULDER_HEIGHT, 0);

  const hand = createPart(new THREE.SphereGeometry(0.1, 12, 8), LEATHER_COLOR, [0, -0.68, 0]);
  pivot.add(createPart(new THREE.BoxGeometry(0.17, 0.62, 0.17), palette.armor, [0, -0.31, 0]), hand);
  return { pivot, hand };
}

function createLeg(palette, side) {
  const pivot = new THREE.Group();
  pivot.position.set(side * HIP_OFFSET, HIP_HEIGHT, 0);
  pivot.add(
    createPart(new THREE.BoxGeometry(0.22, 0.75, 0.22), palette.armor, [0, -0.375, 0]),
    createPart(new THREE.BoxGeometry(0.24, 0.15, 0.3), LEATHER_COLOR, [0, -0.83, 0.04]),
  );
  return pivot;
}

// With the arm down, the blade points forward. Raising the arm raises the blade.
function createSword() {
  const sword = new THREE.Group();
  sword.add(
    createPart(new THREE.BoxGeometry(0.05, 0.05, 0.2), LEATHER_COLOR, [0, 0, 0]),
    createPart(new THREE.BoxGeometry(0.28, 0.05, 0.05), 0xb08a2e, [0, 0, 0.12]),
    createPart(new THREE.BoxGeometry(0.03, 0.09, 0.9), 0xd8dde6, [0, 0, 0.59], { metalness: 0.8, roughness: 0.3 }),
  );
  return sword;
}

function addDawnguardDetails({ palette, upperBody, leftArm }) {
  upperBody.add(createPart(new THREE.BoxGeometry(0.06, 0.14, 0.34), palette.cloth, [0, HEAD_HEIGHT + 0.23, -0.02]));

  const shield = createPart(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), palette.cloth, [LEFT_SIDE * 0.13, -0.4, 0]);
  shield.rotation.z = Math.PI / 2;
  shield.add(createPart(new THREE.SphereGeometry(0.07, 10, 8), palette.trim, [0, 0.03, 0]));
  leftArm.add(shield);
}

function addEmberclawDetails({ palette, upperBody }) {
  for (const side of [-1, 1]) {
    const horn = createPart(new THREE.ConeGeometry(0.05, 0.32, 8), 0xe8e0c8, [side * 0.22, HEAD_HEIGHT + 0.12, 0]);
    horn.rotation.z = -side * 0.7;
    const shoulderSpike = createPart(new THREE.ConeGeometry(0.12, 0.3, 8), palette.trim, [
      side * SHOULDER_OFFSET,
      SHOULDER_HEIGHT + 0.14,
      0,
    ]);
    upperBody.add(horn, shoulderSpike);
  }
}

function createDummyModel() {
  const wood = 0x6b4a2e;
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  root.add(
    createPart(new THREE.BoxGeometry(0.8, 0.08, 0.15), wood, [0, 0.04, 0]),
    createPart(new THREE.BoxGeometry(0.15, 0.08, 0.8), wood, [0, 0.04, 0]),
    createPart(new THREE.CylinderGeometry(0.08, 0.08, 1.1), wood, [0, 0.55, 0]),
    createPart(new THREE.CylinderGeometry(0.3, 0.34, 0.8, 12), 0xc9a45c, [0, 1.4, 0]),
    createPart(new THREE.CylinderGeometry(0.315, 0.33, 0.06, 12), 0x7a5a2a, [0, 1.2, 0]),
    createPart(new THREE.BoxGeometry(1.3, 0.1, 0.1), wood, [0, 1.6, 0]),
    createPart(new THREE.SphereGeometry(0.2, 12, 10), 0xb89968, [0, 2, 0]),
  );
  enableShadows(root);
  return { root, parts: {} };
}

function enableShadows(root) {
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
}
