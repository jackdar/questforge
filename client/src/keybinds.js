export const KEYBINDS = [
  { keys: 'W A S D', action: 'Move and strafe' },
  { keys: 'Space', action: 'Jump' },
  { keys: 'Left-drag', action: 'Turn the camera' },
  { keys: 'Right-drag', action: 'Turn your character' },
  { keys: 'Mouse wheel', action: 'Zoom' },
  { keys: 'Left-click', action: 'Target a character' },
  { keys: 'Tab', action: 'Target the nearest enemy' },
  { keys: 'F1', action: 'Target yourself' },
  { keys: '1 – 5', action: 'Use an ability' },
  { keys: 'Enter', action: 'Chat' },
  { keys: 'Esc', action: 'Clear the target or open the menu' },
  { keys: 'H', action: 'Show or hide this help' },
];

export function renderKeybindList(container) {
  container.replaceChildren(
    ...KEYBINDS.map(({ keys, action }) => {
      const row = document.createElement('div');
      row.className = 'keybind-row';

      const keysElement = document.createElement('kbd');
      keysElement.textContent = keys;

      const actionElement = document.createElement('span');
      actionElement.textContent = action;

      row.append(keysElement, actionElement);
      return row;
    }),
  );
}
