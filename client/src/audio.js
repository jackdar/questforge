import { createMusicPlayer } from './chiptune.js';
import { createSoundEffects } from './sound-effects.js';

const VOLUMES_STORAGE_KEY = 'questforge.audioVolumes';
export const DEFAULT_VOLUMES = { music: 0.5, sfx: 0.8 };

export function loadVolumes(storage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(VOLUMES_STORAGE_KEY)) ?? {};
  } catch (error) {
    console.warn('Could not read the saved audio volumes. The default volumes apply.', error);
    return { ...DEFAULT_VOLUMES };
  }
  return {
    music: clampVolume(saved.music, DEFAULT_VOLUMES.music),
    sfx: clampVolume(saved.sfx, DEFAULT_VOLUMES.sfx),
  };
}

export function saveVolumes(storage, volumes) {
  try {
    storage.setItem(VOLUMES_STORAGE_KEY, JSON.stringify(volumes));
  } catch (error) {
    console.warn('Could not save the audio volumes. They reset when the page reloads.', error);
  }
}

function clampVolume(value, fallback) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(Math.max(value, 0), 1);
}

export function createAudio(storage) {
  const volumes = loadVolumes(storage);
  let context = null;
  let musicGain = null;
  let musicPlayer = null;
  let sfxGain = null;
  let soundEffects = null;

  // Browsers keep an AudioContext silent until the player interacts with the page.
  // Create it on first use, which is always after the player clicks to log in or enter the world.
  function getContext() {
    if (!context) {
      context = new AudioContext();
      musicGain = context.createGain();
      musicGain.gain.value = volumes.music;
      musicGain.connect(context.destination);
      musicPlayer = createMusicPlayer(context, musicGain);
      sfxGain = context.createGain();
      sfxGain.gain.value = volumes.sfx;
      sfxGain.connect(context.destination);
      soundEffects = createSoundEffects(context, sfxGain);
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  // A song that already plays keeps playing, so a new start call for it does not restart it.
  function startMusic(songId) {
    getContext();
    musicPlayer.start(songId);
  }

  function stopMusic() {
    musicPlayer?.stop();
  }

  function setMusicVolume(volume) {
    volumes.music = clampVolume(volume, volumes.music);
    if (musicGain) musicGain.gain.value = volumes.music;
    saveVolumes(storage, volumes);
  }

  function setSfxVolume(volume) {
    volumes.sfx = clampVolume(volume, volumes.sfx);
    if (sfxGain) sfxGain.gain.value = volumes.sfx;
    saveVolumes(storage, volumes);
  }

  function getSoundEffects() {
    getContext();
    return soundEffects;
  }

  return {
    startMusic,
    stopMusic,
    setMusicVolume,
    setSfxVolume,
    getVolumes: () => ({ ...volumes }),
    startCastSound: (durationSeconds) => getSoundEffects().startCastSound(durationSeconds),
    stopCastSound: () => soundEffects?.stopCastSound(),
    playCastRelease: () => getSoundEffects().playCastRelease(),
    playSwing: (style) => getSoundEffects().playSwing(style),
    playHit: () => getSoundEffects().playHit(),
    playLevelUp: () => getSoundEffects().playLevelUp(),
    playCoins: () => getSoundEffects().playCoins(),
  };
}
