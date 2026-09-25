import * as THREE from 'three';

const NIGHT_SKY = new THREE.Color(0x0b1026);
const DAY_SKY = new THREE.Color(0x87b8e0);
const DUSK_SKY = new THREE.Color(0xe08a50);
const SUN_COLOR = new THREE.Color(0xffffff);
const MOON_COLOR = new THREE.Color(0x9fb4ff);
const SUN_INTENSITY = 2;
const MOON_INTENSITY = 0.6;
// At night the world stays dim but playable, so the ambient light never goes below this.
const NIGHT_AMBIENT_INTENSITY = 0.25;
const DAY_AMBIENT_INTENSITY = 1.2;
const LIGHT_DISTANCE = 60;
// The shadows cover a square around the player, the same size as the shadow camera of the light in world.js.
// The square moves in steps of one shadow map pixel, so that the shadow edges do not shimmer while the player walks.
export const SHADOW_AREA_SIZE = 120;
export const SHADOW_MAP_SIZE = 2048;
const SHADOW_PIXEL = SHADOW_AREA_SIZE / SHADOW_MAP_SIZE;
const SKY_DISC_DISTANCE = 170;
// The light and the discs lean a little to the side, so that the sun and moon do not pass straight overhead.
const SKY_SIDE_OFFSET = 20;
// The moon moves along a short arc high in the sky over the whole night, so it moves much slower than the sun.
const MOON_ARC = (70 * Math.PI) / 180;

// The sun rises at 06:00, is highest at noon, and sets at 18:00. Its elevation is -1 at midnight and 1 at noon.
// The moon shows only at night. It rises in the east at 18:00 already high, is highest at midnight, and sets in the
// west at 06:00 while it is still high, as it fades in the dawn.
// One light casts the shadows: the sun by day and the moon by night. It fades out while the sun is near the
// horizon, so the swap from sun to moon shows no jump of the shadows. Daylight fades in over the morning twilight
// and out over the evening twilight, and dusk tints the sky orange.
export function skyAt(dayFraction) {
  const sunAngle = (dayFraction - 0.25) * 2 * Math.PI;
  const elevation = Math.sin(sunAngle);
  const daylight = THREE.MathUtils.smoothstep(elevation, -0.1, 0.25);
  const dusk = Math.max(0, 1 - Math.abs(elevation) / 0.25) * (elevation > -0.2 ? 1 : 0);
  const skyColor = NIGHT_SKY.clone().lerp(DAY_SKY, daylight).lerp(DUSK_SKY, dusk * 0.5);

  const nightProgress = (((dayFraction - 0.75 + 1) % 1) / 0.5) % 1;
  const moonAngle = Math.PI / 2 - (nightProgress - 0.5) * MOON_ARC;
  const sunDirection = { x: Math.cos(sunAngle), y: elevation };
  const moonDirection = { x: Math.cos(moonAngle), y: Math.sin(moonAngle) };

  const isSunUp = elevation >= 0;
  const lightStrength = THREE.MathUtils.smoothstep(Math.abs(elevation), 0, 0.25);
  return {
    daylight,
    skyColor,
    sunDirection,
    moonDirection,
    lightDirection: isSunUp ? sunDirection : moonDirection,
    lightIntensity: (isSunUp ? SUN_INTENSITY : MOON_INTENSITY) * lightStrength,
    lightColor: isSunUp ? SUN_COLOR : MOON_COLOR,
    sunVisibility: THREE.MathUtils.smoothstep(elevation, -0.05, 0.05),
    moonVisibility: isSunUp ? 0 : lightStrength,
  };
}

// The lights and colours of the scene follow the time of day. The sun and moon discs stay at the same place in the
// sky around the camera, and the light that casts the shadows follows the player, so that there are shadows
// wherever the player walks. Returns the daylight, from 0 at night to 1 by day.
export function applySky(dayFraction, lighting) {
  const { scene, celestialLight, ambient, sunDisc, moonDisc, cameraPosition, playerPosition } = lighting;
  const sky = skyAt(dayFraction);
  scene.background.copy(sky.skyColor);
  scene.fog.color.copy(sky.skyColor);

  const { x, y } = sky.lightDirection;
  const shadowCenter = {
    x: Math.round(playerPosition.x / SHADOW_PIXEL) * SHADOW_PIXEL,
    z: Math.round(playerPosition.z / SHADOW_PIXEL) * SHADOW_PIXEL,
  };
  celestialLight.target.position.set(shadowCenter.x, 0, shadowCenter.z);
  celestialLight.position.set(
    shadowCenter.x + x * LIGHT_DISTANCE,
    y * LIGHT_DISTANCE,
    shadowCenter.z + SKY_SIDE_OFFSET,
  );
  celestialLight.intensity = sky.lightIntensity;
  celestialLight.color.copy(sky.lightColor);
  ambient.intensity = NIGHT_AMBIENT_INTENSITY + (DAY_AMBIENT_INTENSITY - NIGHT_AMBIENT_INTENSITY) * sky.daylight;

  placeDisc(sunDisc, sky.sunDirection, sky.sunVisibility, cameraPosition);
  placeDisc(moonDisc, sky.moonDirection, sky.moonVisibility, cameraPosition);
  return sky.daylight;
}

function placeDisc(disc, { x, y }, visibility, cameraPosition) {
  disc.visible = visibility > 0;
  disc.material.opacity = visibility;
  disc.position.set(
    cameraPosition.x + x * SKY_DISC_DISTANCE,
    cameraPosition.y + y * SKY_DISC_DISTANCE,
    cameraPosition.z + SKY_SIDE_OFFSET,
  );
}
