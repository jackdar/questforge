import * as THREE from 'three';

const RING_RADIUS = 1.6;
const CENTER_HEIGHT = 1.8;
const SWIRL_COLOR = 0x7a4aff;
const LIGHT_INTENSITY = 8;
const SPARK_COUNT = 40;

// A portal is a standing ring of stone around a slowly turning purple swirl, with sparks that spiral in and a glow.
export function createPortal({ x, z, rotation }, groundHeightAt) {
  const portal = new THREE.Group();
  portal.position.set(x, groundHeightAt(x, z), z);
  portal.rotation.y = rotation;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(RING_RADIUS, 0.16, 12, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a3440, roughness: 0.9 }),
  );
  ring.position.y = CENTER_HEIGHT;
  ring.castShadow = true;

  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(RING_RADIUS - 0.05, 48),
    new THREE.MeshBasicMaterial({
      color: SWIRL_COLOR,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  swirl.position.y = CENTER_HEIGHT;

  const sparkPositions = new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3);
  const sparks = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', sparkPositions),
    new THREE.PointsMaterial({
      color: 0xd8c8ff,
      size: 0.1,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sparks.position.y = CENTER_HEIGHT;

  const light = new THREE.PointLight(0x8a5aff, LIGHT_INTENSITY, 10);
  light.position.set(0, CENTER_HEIGHT, 0.5);
  portal.add(ring, swirl, sparks, light);

  // Each spark circles inward from the ring to the middle and starts again, at its own point in the circle.
  function update(time) {
    const seconds = time / 1000;
    swirl.rotation.z = seconds * 0.8;
    swirl.material.opacity = 0.5 + 0.12 * Math.sin(seconds * 2.3);
    light.intensity = LIGHT_INTENSITY * (1 + 0.15 * Math.sin(seconds * 3.1));

    const positions = sparks.geometry.attributes.position;
    for (let index = 0; index < SPARK_COUNT; index++) {
      const progress = (seconds * 0.4 + index / SPARK_COUNT) % 1;
      const angle = index * 2.4 + seconds * 2;
      const radius = RING_RADIUS * (1 - progress);
      positions.setXYZ(index, Math.cos(angle) * radius, Math.sin(angle) * radius, 0.05);
    }
    positions.needsUpdate = true;
  }

  return { object: portal, update };
}

// Two rough stone pillars and a lintel frame the portal in the cave mouth.
export function createPortalArch({ x, z, rotation }, groundHeightAt) {
  const arch = new THREE.Group();
  arch.position.set(x, groundHeightAt(x, z), z);
  arch.rotation.y = rotation;
  const rock = new THREE.MeshStandardMaterial({ color: 0x4a4540, roughness: 1 });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 4.4, 1.1), rock);
    pillar.position.set(side * 2.4, 2.2, 0);
    pillar.rotation.y = side * 0.15;
    arch.add(pillar);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 1.3), rock);
  lintel.position.y = 4.6;
  arch.add(lintel);
  arch.traverse((object) => {
    if (object.isMesh) object.castShadow = true;
  });
  return arch;
}
