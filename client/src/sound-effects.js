import { createDecayEnvelope, createNoiseBuffer, createReverb } from './synth.js';

const CAST_RUMBLE_HZ = 400;
const CAST_RUMBLE_VOLUME = 0.04;
const CAST_SOUND_FADE_SECONDS = 0.02;
// The level-up fanfare climbs a major chord, holds the top chord, and sparkles above it.
const LEVEL_UP_RUN_HZ = [523, 659, 784, 1047];
const LEVEL_UP_RUN_NOTE_SECONDS = 0.09;
const LEVEL_UP_CHORD_HZ = [1047, 1319, 1568];
const LEVEL_UP_CHORD_SECONDS = 1;
const LEVEL_UP_SPARKLE_HZ = [2093, 2637];
const LEVEL_UP_SPARKLE_COUNT = 6;
const LEVEL_UP_SPARKLE_GAP_SECONDS = 0.08;
// A bell rings at partials that are not whole multiples of its lowest note, so it sounds metallic but still musical.
// The higher partials are quieter and die away faster. The level-up sparkles use this ring.
const BELL_PARTIALS = [
  { ratio: 1, volume: 1, decaySeconds: 0.45 },
  { ratio: 2.76, volume: 0.6, decaySeconds: 0.3 },
  { ratio: 5.4, volume: 0.35, decaySeconds: 0.18 },
  { ratio: 8.93, volume: 0.2, decaySeconds: 0.1 },
];
// A partial above this frequency is too high to hear clearly, and the audio output cannot play it cleanly.
const HIGHEST_PARTIAL_HZ = 16000;
// A coin is a small round plate. It rings at these partial ratios, which have no musical relationship, so a clink
// sounds like metal and not like a note. Each clink shifts every partial a little at random and adds a twin a few
// hertz away, so that the partials beat against each other and shimmer like real metal.
const COIN_PLATE_RATIOS = [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.16];
const COIN_BASE_HZ = { min: 3000, max: 4500 };
const COIN_PARTIAL_DETUNE = 0.015;
const COIN_TWIN_OFFSET_HZ = 4;
const COIN_RING_SECONDS = { min: 0.08, max: 0.25 };
// The jingle is a few clinks, a little apart, like coins that land on each other. Every clink picks new random
// pitches, so the jingle never repeats as a tune.
const COIN_CLINKS = [
  { delay: 0, volume: 0.035 },
  { delay: 0.055, volume: 0.03 },
  { delay: 0.12, volume: 0.026 },
  { delay: 0.19, volume: 0.022 },
];
// The strike of metal on metal is a very short burst of high noise at the start of each clink.
const COIN_STRIKE = { frequency: 5000, seconds: 0.008, volume: 0.12 };
const REVERB = { seconds: 1.2, decay: 3, mix: 0.35 };
const SWING_SOUNDS = {
  light: { fromHz: 600, toHz: 2400, seconds: 0.15, volume: 0.35 },
  heavy: { fromHz: 300, toHz: 1600, seconds: 0.22, volume: 0.5 },
};

export function createSoundEffects(context, destination) {
  const noiseBuffer = createNoiseBuffer(context);
  const reverbInput = createReverb(context, destination, REVERB);
  let activeCastSound = null;

  function startCastSound(durationSeconds) {
    stopCastSound();
    const startTime = context.currentTime;
    const output = context.createGain();
    output.gain.setValueAtTime(0, startTime);
    output.gain.linearRampToValueAtTime(CAST_RUMBLE_VOLUME, startTime + CAST_SOUND_FADE_SECONDS);
    output.connect(destination);

    const rumble = context.createBufferSource();
    rumble.buffer = noiseBuffer;
    rumble.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = CAST_RUMBLE_HZ;
    rumble.connect(filter).connect(output);
    rumble.start(startTime);
    rumble.stop(startTime + durationSeconds);

    activeCastSound = { output, rumble };
  }

  // A short fade avoids the click that an instant cut makes.
  function stopCastSound() {
    if (!activeCastSound) return;
    const { output, rumble } = activeCastSound;
    const time = context.currentTime;
    output.gain.cancelScheduledValues(time);
    output.gain.setValueAtTime(output.gain.value, time);
    output.gain.linearRampToValueAtTime(0, time + CAST_SOUND_FADE_SECONDS);
    rumble.stop(time + CAST_SOUND_FADE_SECONDS);
    activeCastSound = null;
  }

  function playCastRelease() {
    playSweep({ waveform: 'square', fromHz: 1200, toHz: 200, time: context.currentTime, seconds: 0.18, volume: 0.15 });
  }

  function playSwing(style) {
    const { fromHz, toHz, seconds, volume } = SWING_SOUNDS[style];
    const time = context.currentTime;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromHz, time);
    filter.frequency.exponentialRampToValueAtTime(toHz, time + seconds);
    playNoise(filter, time, seconds, volume);
  }

  function playHit() {
    const time = context.currentTime;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    playNoise(filter, time, 0.1, 0.4);
    playSweep({ waveform: 'square', fromHz: 220, toHz: 55, time, seconds: 0.1, volume: 0.15 });
  }

  function playLevelUp() {
    const start = context.currentTime;
    const withReverb = true;
    LEVEL_UP_RUN_HZ.forEach((frequency, index) => {
      const time = start + index * LEVEL_UP_RUN_NOTE_SECONDS;
      const seconds = LEVEL_UP_RUN_NOTE_SECONDS;
      playNote({ waveform: 'square', frequency, time, seconds, volume: 0.1, withReverb });
    });

    const chordStart = start + LEVEL_UP_RUN_HZ.length * LEVEL_UP_RUN_NOTE_SECONDS;
    LEVEL_UP_CHORD_HZ.forEach((frequency, index) => {
      const waveform = index === 0 ? 'triangle' : 'square';
      playNote({ waveform, frequency, time: chordStart, seconds: LEVEL_UP_CHORD_SECONDS, volume: 0.07, withReverb });
    });
    for (let index = 0; index < LEVEL_UP_SPARKLE_COUNT; index++) {
      const baseHz = LEVEL_UP_SPARKLE_HZ[index % LEVEL_UP_SPARKLE_HZ.length];
      playBellRing({ baseHz, time: chordStart + 0.05 + index * LEVEL_UP_SPARKLE_GAP_SECONDS, volume: 0.03 });
    }
  }

  function playCoins() {
    const start = context.currentTime;
    for (const { delay, volume } of COIN_CLINKS) playCoinClink(start + delay, volume);
  }

  function playCoinClink(time, volume) {
    const strikeFilter = context.createBiquadFilter();
    strikeFilter.type = 'highpass';
    strikeFilter.frequency.value = COIN_STRIKE.frequency;
    playNoise(strikeFilter, time, COIN_STRIKE.seconds, COIN_STRIKE.volume);

    const baseHz = randomBetween(COIN_BASE_HZ);
    for (const ratio of COIN_PLATE_RATIOS) {
      const frequency = baseHz * ratio * (1 + (Math.random() * 2 - 1) * COIN_PARTIAL_DETUNE);
      const partialVolume = volume * (0.4 + Math.random() * 0.6);
      const ringSeconds = randomBetween(COIN_RING_SECONDS);
      playRingingPartial(frequency, time, partialVolume, ringSeconds);
      playRingingPartial(frequency + COIN_TWIN_OFFSET_HZ, time, partialVolume * 0.7, ringSeconds);
    }
  }

  function playBellRing({ baseHz, time, volume }) {
    for (const partial of BELL_PARTIALS) {
      playRingingPartial(baseHz * partial.ratio, time, volume * partial.volume, partial.decaySeconds);
    }
  }

  // A partial starts at once and fades out smoothly, like struck metal. It also goes through the reverb, so that
  // it rings on for a moment.
  function playRingingPartial(frequency, time, volume, seconds) {
    if (frequency > HIGHEST_PARTIAL_HZ) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(volume, time + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + seconds);
    oscillator.connect(envelope);
    envelope.connect(destination);
    envelope.connect(reverbInput);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }

  function playNote({ waveform, frequency, time, seconds, volume, withReverb = false }) {
    playSweep({ waveform, fromHz: frequency, toHz: frequency, time, seconds, volume, withReverb });
  }

  function playSweep({ waveform, fromHz, toHz, time, seconds, volume, withReverb = false }) {
    const oscillator = context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(fromHz, time);
    oscillator.frequency.exponentialRampToValueAtTime(toHz, time + seconds);
    const envelope = createDecayEnvelope(context, time, seconds, volume);
    oscillator.connect(envelope);
    envelope.connect(destination);
    if (withReverb) envelope.connect(reverbInput);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }

  function playNoise(filter, time, seconds, volume) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.connect(filter).connect(createDecayEnvelope(context, time, seconds, volume)).connect(destination);
    source.start(time);
    source.stop(time + seconds);
  }

  return { startCastSound, stopCastSound, playCastRelease, playSwing, playHit, playLevelUp, playCoins };
}

function randomBetween({ min, max }) {
  return min + Math.random() * (max - min);
}
