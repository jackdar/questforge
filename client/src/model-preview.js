import * as THREE from 'three';
import { createCharacterModel, disposeCharacterModel } from './character-model.js';
import { createCharacterAnimator } from './character-animator.js';

const TURN_RADIANS_PER_SECOND = 0.6;

export function createModelPreview(canvas, appearance) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

  const scene = new THREE.Scene();
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(2, 3, 4);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5), keyLight);

  const camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 20);
  camera.position.set(0, 1.4, 5);
  camera.lookAt(0, 1.1, 0);

  const { root, parts } = createCharacterModel(appearance);
  scene.add(root);
  const animator = createCharacterAnimator(parts);

  let previousTime = performance.now();
  renderer.setAnimationLoop((time) => {
    const deltaSeconds = (time - previousTime) / 1000;
    previousTime = time;

    root.rotation.y += TURN_RADIANS_PER_SECOND * deltaSeconds;
    animator.update(time, deltaSeconds, false);
    renderer.render(scene, camera);
  });

  // Each preview has its own WebGL context. Release it, because browsers limit how many contexts a page can hold.
  function dispose() {
    renderer.setAnimationLoop(null);
    disposeCharacterModel(root);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { dispose };
}
