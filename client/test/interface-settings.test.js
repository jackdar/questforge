import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERFACE_SETTINGS,
  createInterfaceSettings,
  loadInterfaceSettings,
} from '../src/interface-settings.js';

const emptyStorage = {
  items: new Map(),
  getItem(key) {
    return this.items.get(key) ?? null;
  },
  setItem(key, value) {
    this.items.set(key, value);
  },
};

test('only the target nameplate shows by default', () => {
  const storage = { ...emptyStorage, items: new Map() };

  assert.deepEqual(loadInterfaceSettings(storage), { showAllNameplates: false, showOwnNameplate: false });
});

test('a changed setting is saved and loads back', () => {
  const storage = { ...emptyStorage, items: new Map() };

  createInterfaceSettings(storage).set('showOwnNameplate', true);

  assert.equal(loadInterfaceSettings(storage).showOwnNameplate, true);
});

test('toggling a setting flips it and tells every listener', () => {
  const storage = { ...emptyStorage, items: new Map() };
  const settings = createInterfaceSettings(storage);
  const changes = [];
  settings.onChange((name, value) => changes.push([name, value]));

  settings.toggle('showAllNameplates');

  assert.equal(settings.get('showAllNameplates'), true);
  assert.deepEqual(changes, [['showAllNameplates', true]]);
});

test('a saved setting that is not true or false loads as its default', () => {
  const storage = {
    ...emptyStorage,
    items: new Map([['questforge.interfaceSettings', '{"showAllNameplates":"yes"}']]),
  };

  assert.deepEqual(loadInterfaceSettings(storage), DEFAULT_INTERFACE_SETTINGS);
});

test('corrupt saved settings load as the defaults', () => {
  const storage = { ...emptyStorage, items: new Map([['questforge.interfaceSettings', '{not json']]) };

  assert.deepEqual(loadInterfaceSettings(storage), DEFAULT_INTERFACE_SETTINGS);
});

test('settings still change when the storage cannot be written', () => {
  const storage = {
    ...emptyStorage,
    items: new Map(),
    setItem() {
      throw new Error('Storage is full');
    },
  };
  const settings = createInterfaceSettings(storage);

  settings.set('showOwnNameplate', true);

  assert.equal(settings.get('showOwnNameplate'), true);
});
