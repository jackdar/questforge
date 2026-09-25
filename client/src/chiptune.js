import { createDecayEnvelope, createNoiseBuffer } from './synth.js';

const SCHEDULE_AHEAD_SECONDS = 0.1;
const SCHEDULER_INTERVAL_MS = 25;
const NOTE_GATE = 0.9;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_SEMITONES_FROM_C0 = 57;
const PERFECT_FOURTH = 5;
const HOLD = '-';
const REST = '.';

// Tonal drums drop in pitch. Noise drums pass noise through a filter.
export const DRUM_SOUNDS = {
  k: { frequencyFrom: 150, frequencyTo: 40, seconds: 0.15, volume: 0.5 },
  t: { frequencyFrom: 220, frequencyTo: 110, seconds: 0.15, volume: 0.35 },
  l: { frequencyFrom: 140, frequencyTo: 70, seconds: 0.18, volume: 0.4 },
  s: { filter: 'bandpass', frequency: 1800, seconds: 0.1, volume: 0.25 },
  r: { filter: 'bandpass', frequency: 1800, seconds: 0.05, volume: 0.1 },
  c: { filter: 'highpass', frequency: 5000, seconds: 0.6, volume: 0.12 },
  // The cave uses a soft, low heartbeat and a faint drip of water.
  b: { frequencyFrom: 90, frequencyTo: 45, seconds: 0.22, volume: 0.22 },
  d: { filter: 'bandpass', frequency: 3200, seconds: 0.03, volume: 0.05 },
};

// A bar is 16 steps written as text: a note name, HOLD to extend the note before it, or REST.
// A drum step can hold more than one drum letter, for example "kc" for a kick and a crash together.
function parseBar(text) {
  const steps = text.trim().split(/\s+/).map((step) => (step === REST ? null : step));
  if (steps.length !== 16) throw new Error(`A bar must have 16 steps, but this bar has ${steps.length}: "${text}"`);
  return steps;
}

function repeatBeat(beat) {
  return parseBar(Array.from({ length: 4 }, () => beat).join(' '));
}

function transposeNote(note, semitones) {
  if (!note || note === HOLD) return note;
  const index = noteToSemitonesFromC0(note) + semitones;
  return `${NOTE_NAMES[index % 12]}${Math.floor(index / 12)}`;
}

// The song is in D minor. It uses open fifths instead of full chords, and the bass creeps by semitones
// and jumps by tritones for a menacing sound. The brass melody moves mostly in fourths, like a fanfare.
const BAR_ROOTS = ['D', 'D', 'A#', 'A', 'D', 'D#', 'C', 'A'];

const BRASS_BARS = [
  '. . . . . . . . A4 - - D5 A4 - - D5',
  'G5 - - - - - D5 - G5 - A5 - G#5 - - -',
  'F5 - - - - - . . F5 - - A#5 F5 - - A#5',
  'A5 - - - - - - - E5 - A5 - D#5 - E5 -',
  'D6 - - - A5 - - - G5 - - - A5 - D6 -',
  'A#5 - - - D#5 - - - A5 - - - - - - -',
  'G5 - - C6 G5 - - C6 A#5 - A5 - G5 - F5 -',
  'E5 - - - A4 - - - C#5 - E5 - A5 - G#5 -',
];

const BASS_BARS = [
  'D2 - - . D2 - - . D2 - - . C#2 - - .',
  'D2 - - . F2 - - . A2 - - . G#2 - - .',
  'A#1 - - . A#1 - - . D2 - - . F2 - - .',
  'A1 - - . A1 - - . G#1 - - . G1 - - .',
  'D2 - - . D2 - - . F2 - - . E2 - - .',
  'D#2 - - . D#2 - - . A#1 - - . A2 - - .',
  'C2 - - . C2 - - . G1 - - . C#2 - - .',
  'A1 - - . E2 - - . A1 - - . C#2 - - .',
];

const DRUM_BAR = 'k . r r s . r r k . r r s . s s';
const DRUM_BARS = [
  'kc . r r s . r r k . r r s . s s',
  DRUM_BAR,
  DRUM_BAR,
  'k . r r s . r r k k r r s r s s',
  'kc . r r s . r r k . r r s . s s',
  DRUM_BAR,
  DRUM_BAR,
  'k . s s t . t t l . l l s s s s',
];

const brassNotes = BRASS_BARS.flatMap(parseBar);
const octaveOstinatoNotes = BAR_ROOTS.flatMap((root) => repeatBeat(`${root}3 ${root}4 ${root}3 ${root}4`));

// Each step is one sixteenth note.
// The overworld song: a slow, heavy beat with busy sixteenth notes inside it, like a war march.
const OVERWORLD_SONG = {
  beatsPerMinute: 96,
  voices: [
    { waveform: 'sawtooth', volume: 0.06, notes: brassNotes },
    { waveform: 'sawtooth', volume: 0.035, notes: brassNotes.map((note) => transposeNote(note, -PERFECT_FOURTH)) },
    { waveform: 'square', volume: 0.03, notes: octaveOstinatoNotes },
    { waveform: 'sawtooth', volume: 0.09, notes: BASS_BARS.flatMap(parseBar) },
  ],
  drums: DRUM_BARS.flatMap(parseBar),
};

// The cave song is quiet and tense. A low drone creeps down a semitone and back, and a few lonely notes fall into
// long silences, several a tritone from the drone, which sounds uneasy. Faint high pings sound like drops of water,
// and a soft double beat like a heartbeat comes every other bar.
const CAVE_DRONE_BARS = [
  'D2 - - - - - - - - - - - - - - -',
  'D2 - - - - - - - - - - - - - - -',
  'D2 - - - - - - - - - - - - - - -',
  'D2 - - - - - - - - - - - - - - -',
  'C#2 - - - - - - - - - - - - - - -',
  'C#2 - - - - - - - - - - - - - - -',
  'D#2 - - - - - - - - - - - - - - -',
  'D2 - - - - - - - - - - - - - - -',
];
const CAVE_LEAD_BARS = [
  '. . . . . . . . A4 - - - . . . .',
  '. . . . . . . . . . . . G#4 - - -',
  '. . . . F4 - - - . . . . E4 - - -',
  '. . . . . . . . . . . . . . . .',
  'A#4 - - - - - . . . . . . A4 - - -',
  '. . . . . . . . D5 - - - C#5 - - -',
  '. . . . . . . . . . . . . . . .',
  'G#4 - - - - - - - . . . . . . . .',
];
const CAVE_DRIP_BARS = [
  '. . . . . . . . . . . . . . . .',
  '. . . . D6 . . . . . . . . . . .',
  '. . . . . . . . . . . . . . A5 .',
  '. . . . . . G#5 . . . . . . . . .',
  '. . . . . . . . . . . . . . . .',
  '. . D6 . . . . . . . . . . . . .',
  '. . . . . . . . . . A5 . . . . .',
  '. . . . . . . . . . . . . . . .',
];
const CAVE_BEAT_BAR = 'b . b . . . . . . . . . . . . .';
const CAVE_QUIET_BAR = '. . . . . . d . . . . . . . . .';
const CAVE_SONG = {
  beatsPerMinute: 64,
  voices: [
    { waveform: 'triangle', volume: 0.16, notes: CAVE_DRONE_BARS.flatMap(parseBar) },
    { waveform: 'square', volume: 0.025, notes: CAVE_LEAD_BARS.flatMap(parseBar) },
    { waveform: 'sine', volume: 0.03, notes: CAVE_DRIP_BARS.flatMap(parseBar) },
  ],
  drums: Array.from({ length: 8 }, (_, bar) => parseBar(bar % 2 === 0 ? CAVE_BEAT_BAR : CAVE_QUIET_BAR)).flat(),
};

// Each map plays its own song.
export const SONGS = { overworld: OVERWORLD_SONG, cave: CAVE_SONG };

export function noteToFrequency(note) {
  return 440 * 2 ** ((noteToSemitonesFromC0(note) - A4_SEMITONES_FROM_C0) / 12);
}

function noteToSemitonesFromC0(note) {
  const [, name, octave] = note.match(/^([A-G]#?)(\d)$/);
  return NOTE_NAMES.indexOf(name) + Number(octave) * 12;
}

export function countNoteSteps(track, startIndex) {
  let steps = 1;
  while (track[startIndex + steps] === HOLD) steps += 1;
  return steps;
}

// Each step is one sixteenth note of the song.
function stepSecondsOf(song) {
  return 60 / song.beatsPerMinute / 4;
}

// Starting another song stops the one that plays and starts the new one from its beginning.
export function createMusicPlayer(context, destination) {
  const noiseBuffer = createNoiseBuffer(context);
  let schedulerId = null;
  let songOutput = null;
  let song = null;
  let nextStepIndex = 0;
  let nextStepTime = 0;

  function start(songId) {
    if (schedulerId !== null && song === SONGS[songId]) return;
    stop();
    song = SONGS[songId];
    songOutput = context.createGain();
    songOutput.connect(destination);
    nextStepIndex = 0;
    nextStepTime = context.currentTime + SCHEDULE_AHEAD_SECONDS;
    schedulerId = setInterval(scheduleAhead, SCHEDULER_INTERVAL_MS);
  }

  // Notes are already queued in the audio graph. Disconnecting their output silences them at once.
  function stop() {
    if (schedulerId === null) return;
    clearInterval(schedulerId);
    schedulerId = null;
    songOutput.disconnect();
    songOutput = null;
  }

  // A timer alone drifts and stalls in background tabs, so it only queues notes a short time ahead on the audio clock.
  function scheduleAhead() {
    while (nextStepTime < context.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleStep(nextStepIndex, nextStepTime);
      nextStepIndex = (nextStepIndex + 1) % song.drums.length;
      nextStepTime += stepSecondsOf(song);
    }
  }

  function scheduleStep(index, time) {
    for (const { waveform, volume, notes } of song.voices) scheduleTone(notes, index, time, waveform, volume);
    for (const drumLetter of song.drums[index] ?? '') {
      const drum = DRUM_SOUNDS[drumLetter];
      if (drum.filter) playNoiseDrum(drum, time);
      else playTonalDrum(drum, time);
    }
  }

  function scheduleTone(track, index, time, waveform, volume) {
    const note = track[index];
    if (!note || note === HOLD) return;
    const seconds = countNoteSteps(track, index) * stepSecondsOf(song) * NOTE_GATE;

    const oscillator = context.createOscillator();
    oscillator.type = waveform;
    oscillator.frequency.value = noteToFrequency(note);
    const envelope = createDecayEnvelope(context, time, seconds, volume);
    oscillator.connect(envelope).connect(songOutput);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }

  function playTonalDrum({ frequencyFrom, frequencyTo, seconds, volume }, time) {
    const oscillator = context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequencyFrom, time);
    oscillator.frequency.exponentialRampToValueAtTime(frequencyTo, time + seconds);
    oscillator.connect(createDecayEnvelope(context, time, seconds, volume)).connect(songOutput);
    oscillator.start(time);
    oscillator.stop(time + seconds);
  }

  function playNoiseDrum({ filter: filterType, frequency, seconds, volume }, time) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    source.connect(filter).connect(createDecayEnvelope(context, time, seconds, volume)).connect(songOutput);
    source.start(time);
    source.stop(time + seconds);
  }

  return { start, stop };
}
