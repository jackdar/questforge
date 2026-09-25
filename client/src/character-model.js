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
  marshal: { armor: 0x8c7a5b, cloth: 0x2f6b3a, trim: 0xd4af37, helmet: 0x6b5a3f },
  ranger: { armor: 0x5a4a32, cloth: 0x3f5f2a, trim: 0x8a6b3a, helmet: 0x4a3b28 },
  dwarf: { armor: 0x7a5a3a, cloth: 0x8a3a1f, trim: 0xd4af37, helmet: 0x9a9aa4, beard: 0xb5652b },
  bandit: { armor: 0x4a3a2a, cloth: 0x3a2e24, trim: 0x2a2a2a, helmet: 0x5a4a3a, bandana: 0x9a1f1f },
  banditLeader: { armor: 0x2e2622, cloth: 0x5a1414, trim: 0xb08a2e, helmet: 0x3a2e24, bandana: 0x1a1a1a },
};

// A dwarf is short and broad. The scale changes the whole model, so the parts keep their places on the body.
const APPEARANCE_SCALES = {
  dwarf: [1.2, 0.78, 1.2],
  banditLeader: [1.1, 1.1, 1.1],
};

const APPEARANCE_DETAILS = {
  dawnguard: addDawnguardDetails,
  emberclaw: addEmberclawDetails,
  dwarf: addDwarfDetails,
  bandit: addBanditDetails,
  banditLeader: addBanditDetails,
};

// The model origin is at the feet. A rotation of 0 faces the +z direction.
export function createCharacterModel(appearance) {
  if (appearance === 'dummy') return createDummyModel();
  if (WOLF_LOOKS[appearance]) return createWolfModel(WOLF_LOOKS[appearance]);
  if (SPIDER_LOOKS[appearance]) return createSpiderModel(SPIDER_LOOKS[appearance]);

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

  APPEARANCE_DETAILS[appearance]?.({ palette, upperBody, leftArm: leftArm.pivot });
  const scale = APPEARANCE_SCALES[appearance];
  if (scale) root.scale.set(...scale);
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

// A bandana covers the lower face under the helmet, and its knot hangs at the back of the head.
function addBanditDetails({ palette, upperBody }) {
  upperBody.add(
    createPart(new THREE.BoxGeometry(0.4, 0.12, 0.3), palette.bandana, [0, HEAD_HEIGHT - 0.1, 0.06]),
    createPart(new THREE.BoxGeometry(0.1, 0.16, 0.08), palette.bandana, [0, HEAD_HEIGHT - 0.14, -0.22]),
  );
}

// The beard covers the chin and hangs down onto the chest.
function addDwarfDetails({ palette, upperBody }) {
  upperBody.add(
    createPart(new THREE.BoxGeometry(0.34, 0.2, 0.12), palette.beard, [0, HEAD_HEIGHT - 0.14, 0.16]),
    createPart(new THREE.BoxGeometry(0.28, 0.34, 0.1), palette.beard, [0, HEAD_HEIGHT - 0.36, 0.2]),
  );
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

const WOLF_LEG_HEIGHT = 0.5;
// The alpha wolf is a larger wolf with darker fur.
const WOLF_LOOKS = {
  wolf: { fur: 0x6e6a66, darkFur: 0x4a4643, scale: 1 },
  alphaWolf: { fur: 0x45403c, darkFur: 0x2a2624, scale: 1.35 },
};

// The wolf faces +z like a character. Each leg turns around a pivot at the hip, so that an animator can move it.
function createWolfModel({ fur, darkFur, scale }) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const head = new THREE.Group();
  head.position.set(0, 0.95, 0.65);
  head.add(
    createPart(new THREE.BoxGeometry(0.34, 0.3, 0.34), fur, [0, 0, 0]),
    createPart(new THREE.BoxGeometry(0.18, 0.16, 0.26), darkFur, [0, -0.06, 0.28]),
    createPart(new THREE.BoxGeometry(0.06, 0.06, 0.04), 0x111111, [0, -0.02, 0.42]),
  );
  for (const side of [LEFT_SIDE, RIGHT_SIDE]) {
    head.add(
      createPart(new THREE.ConeGeometry(0.06, 0.16, 4), darkFur, [side * 0.1, 0.22, -0.04]),
      createPart(new THREE.BoxGeometry(0.05, 0.04, 0.02), 0xe8c030, [side * 0.09, 0.05, 0.17]),
    );
  }

  const tail = createPart(new THREE.BoxGeometry(0.1, 0.1, 0.5), darkFur, [0, 0.8, -0.72]);
  tail.rotation.x = 0.6;

  const legs = {
    frontLeftLeg: createWolfLeg(LEFT_SIDE, 0.4, fur, darkFur),
    frontRightLeg: createWolfLeg(RIGHT_SIDE, 0.4, fur, darkFur),
    backLeftLeg: createWolfLeg(LEFT_SIDE, -0.4, fur, darkFur),
    backRightLeg: createWolfLeg(RIGHT_SIDE, -0.4, fur, darkFur),
  };

  root.add(
    createPart(new THREE.BoxGeometry(0.42, 0.42, 1.1), fur, [0, 0.72, 0]),
    createPart(new THREE.BoxGeometry(0.46, 0.46, 0.4), darkFur, [0, 0.76, 0.3]),
    head,
    tail,
    ...Object.values(legs),
  );
  root.scale.setScalar(scale);
  enableShadows(root);
  return { root, parts: { head, tail, ...legs } };
}

function createWolfLeg(side, forwardOffset, fur, darkFur) {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.14, WOLF_LEG_HEIGHT + 0.05, forwardOffset);
  pivot.add(
    createPart(new THREE.BoxGeometry(0.12, WOLF_LEG_HEIGHT, 0.12), fur, [0, -WOLF_LEG_HEIGHT / 2, 0]),
    createPart(new THREE.BoxGeometry(0.14, 0.06, 0.18), darkFur, [0, -WOLF_LEG_HEIGHT - 0.02, 0.03]),
  );
  return pivot;
}

// A spiderling is a small spider, and the Broodmother is a huge one with violet markings.
const SPIDER_LOOKS = {
  giantSpider: { body: 0x2a2320, markings: 0x7a2a1a, scale: 1 },
  spiderling: { body: 0x3a302a, markings: 0x6a4a2a, scale: 0.45 },
  broodmother: { body: 0x1e1822, markings: 0x6a2a8a, scale: 2.3 },
};
const SPIDER_BODY_HEIGHT = 0.72;
// The legs spread from the front to the back of the body. The front pair points forward and the back pair backward.
const SPIDER_LEG_PLACES = [
  { forward: 0.4, spread: 0.7 },
  { forward: 0.18, spread: 0.25 },
  { forward: -0.04, spread: -0.2 },
  { forward: -0.26, spread: -0.65 },
];

// The spider faces +z like a character. Each leg turns around a pivot at the body, so that an animator can step it.
function createSpiderModel({ body, markings, scale }) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';

  const abdomen = createPart(new THREE.SphereGeometry(0.55, 16, 12), body, [0, SPIDER_BODY_HEIGHT + 0.05, -0.6]);
  abdomen.scale.set(1, 0.8, 1.25);
  const marking = createPart(new THREE.SphereGeometry(0.2, 12, 8), markings, [0, SPIDER_BODY_HEIGHT + 0.46, -0.6]);
  marking.scale.set(1, 0.3, 1.6);
  const thorax = createPart(new THREE.SphereGeometry(0.34, 14, 10), body, [0, SPIDER_BODY_HEIGHT, 0.12]);

  const head = new THREE.Group();
  head.position.set(0, SPIDER_BODY_HEIGHT, 0.42);
  head.add(createPart(new THREE.SphereGeometry(0.2, 12, 8), body, [0, 0, 0]));
  for (const side of [LEFT_SIDE, RIGHT_SIDE]) {
    for (const [dx, dy] of [
      [0.07, 0.08],
      [0.13, 0.03],
    ]) {
      head.add(
        createPart(new THREE.SphereGeometry(0.035, 8, 6), 0xff2a1a, [side * dx, dy, 0.17], {
          emissive: 0xff2a1a,
          emissiveIntensity: 0.8,
        }),
      );
    }
    const fang = createPart(new THREE.ConeGeometry(0.04, 0.2, 6), 0xd8d0c0, [side * 0.07, -0.14, 0.16]);
    fang.rotation.x = Math.PI;
    head.add(fang);
  }

  const legs = [];
  for (const side of [LEFT_SIDE, RIGHT_SIDE]) {
    for (const { forward, spread } of SPIDER_LEG_PLACES) legs.push(createSpiderLeg(side, forward, spread, body));
  }

  root.add(abdomen, marking, thorax, head, ...legs);
  root.scale.setScalar(scale);
  enableShadows(root);
  return { root, parts: { head, legs } };
}

// A leg rises from the body to a knee and bends down to the ground, like a real spider leg.
function createSpiderLeg(side, forward, spread, color) {
  const pivot = new THREE.Group();
  pivot.position.set(side * 0.22, SPIDER_BODY_HEIGHT, forward);
  pivot.rotation.y = -side * spread;
  pivot.userData.restRotationY = pivot.rotation.y;

  const upper = createPart(new THREE.BoxGeometry(0.7, 0.07, 0.07), color, [side * 0.33, 0.15, 0]);
  upper.rotation.z = side * 0.45;
  const lower = createPart(new THREE.BoxGeometry(0.07, 0.95, 0.07), color, [side * 0.7, -0.28, 0]);
  lower.rotation.z = side * -0.3;
  pivot.add(upper, lower);
  return pivot;
}

function enableShadows(root) {
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
}
