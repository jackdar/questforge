import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRUM_SOUNDS, SONGS, countNoteSteps, noteToFrequency } from '../src/chiptune.js';

test('A4 is 440 Hz', () => {
  assert.equal(noteToFrequency('A4'), 440);
});

test('A5 is one octave above A4', () => {
  assert.equal(noteToFrequency('A5'), 880);
});

test('G#4 is one semitone below A4', () => {
  assert.equal(noteToFrequency('G#4'), 440 / 2 ** (1 / 12));
});

const songs = Object.entries(SONGS);

test('every song voice has as many steps as the drums of its song, so the tracks loop together', () => {
  for (const [songId, song] of songs) {
    for (const voice of song.voices) assert.equal(voice.notes.length, song.drums.length, songId);
  }
});

test('the cave song is slower than the overworld song and has far fewer drum beats', () => {
  assert.ok(SONGS.cave.beatsPerMinute < SONGS.overworld.beatsPerMinute);
  assert.ok(SONGS.cave.drums.filter(Boolean).length < SONGS.overworld.drums.filter(Boolean).length / 4);
});

test('every note in the song has a valid name', () => {
  const notes = songs
    .flatMap(([, song]) => song.voices)
    .flatMap((voice) => voice.notes)
    .filter((note) => note && note !== '-');

  for (const note of notes) assert.ok(Number.isFinite(noteToFrequency(note)), note);
});

test('every drum letter in the song has a drum sound', () => {
  const letters = songs.flatMap(([, song]) => song.drums.filter(Boolean)).flatMap((step) => [...step]);

  for (const letter of letters) assert.ok(DRUM_SOUNDS[letter], letter);
});

test('C4 is nine semitones below A4', () => {
  assert.equal(noteToFrequency('C4'), 440 / 2 ** (9 / 12));
});

test('a note without holds lasts one step', () => {
  assert.equal(countNoteSteps(['A4', 'C5'], 0), 1);
});

test('a held note lasts until the next note', () => {
  assert.equal(countNoteSteps(['A4', '-', '-', 'C5'], 0), 3);
});

test('a held note stops at a rest', () => {
  assert.equal(countNoteSteps(['A4', '-', null, '-'], 0), 2);
});
