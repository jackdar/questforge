const SETTINGS_STORAGE_KEY = 'questforge.interfaceSettings';
// By default only the target has a nameplate, and the own nameplate is hidden.
export const DEFAULT_INTERFACE_SETTINGS = { showAllNameplates: false, showOwnNameplate: false };

export function loadInterfaceSettings(storage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY)) ?? {};
  } catch (error) {
    console.warn('Could not read the saved interface settings. The default settings apply.', error);
    return { ...DEFAULT_INTERFACE_SETTINGS };
  }
  return Object.fromEntries(
    Object.entries(DEFAULT_INTERFACE_SETTINGS).map(([name, fallback]) => [
      name,
      typeof saved[name] === 'boolean' ? saved[name] : fallback,
    ]),
  );
}

export function saveInterfaceSettings(storage, settings) {
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Could not save the interface settings. They reset when the page reloads.', error);
  }
}

// A setting can change from the game menu or from a key, so the listeners keep every view in step.
export function createInterfaceSettings(storage) {
  const settings = loadInterfaceSettings(storage);
  const listeners = [];

  function set(name, value) {
    settings[name] = value;
    saveInterfaceSettings(storage, settings);
    for (const listener of listeners) listener(name, value);
  }

  return {
    get: (name) => settings[name],
    set,
    toggle: (name) => set(name, !settings[name]),
    onChange: (listener) => listeners.push(listener),
  };
}
