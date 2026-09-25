import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_VOLUMES, loadVolumes, saveVolumes } from '../src/audio.js';

const emptyStorage = {
  items: new Map(),
  getItem(key) {
    return this.items.get(key) ?? null;
  },
  setItem(key, value) {
    this.items.set(key, value);
  },
};

test('volumes load as the defaults when nothing is saved', () => {
  const storage = { ...emptyStorage, items: new Map() };

  assert.deepEqual(loadVolumes(storage), DEFAULT_VOLUMES);
});

test('saved volumes load back unchanged', () => {
  const storage = { ...emptyStorage, items: new Map() };

  saveVolumes(storage, { music: 0.2, sfx: 0.6 });

  assert.deepEqual(loadVolumes(storage), { music: 0.2, sfx: 0.6 });
});

test('saved volumes outside 0 to 1 load clamped to that range', () => {
  const storage = { ...emptyStorage, items: new Map([['questforge.audioVolumes', '{"music":3,"sfx":-1}']]) };

  assert.deepEqual(loadVolumes(storage), { music: 1, sfx: 0 });
});

test('a saved volume that is not a number loads as its default', () => {
  const storage = { ...emptyStorage, items: new Map([['questforge.audioVolumes', '{"music":"loud"}']]) };

  assert.deepEqual(loadVolumes(storage), DEFAULT_VOLUMES);
});

test('corrupt saved volumes load as the defaults', () => {
  const storage = { ...emptyStorage, items: new Map([['questforge.audioVolumes', '{not json']]) };

  assert.deepEqual(loadVolumes(storage), DEFAULT_VOLUMES);
});

test('volumes load as the defaults when the storage cannot be read', () => {
  const storage = {
    ...emptyStorage,
    getItem() {
      throw new Error('Storage is blocked');
    },
  };

  assert.deepEqual(loadVolumes(storage), DEFAULT_VOLUMES);
});

test('saving volumes does not throw when the storage cannot be written', () => {
  const storage = {
    ...emptyStorage,
    setItem() {
      throw new Error('Storage is full');
    },
  };

  assert.doesNotThrow(() => saveVolumes(storage, DEFAULT_VOLUMES));
});
