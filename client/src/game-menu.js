export function createGameMenu({ onLogOut, audio, interfaceSettings }) {
  const overlay = document.getElementById('game-menu');
  const mainPanel = overlay.querySelector('[data-panel="main"]');
  const audioPanel = overlay.querySelector('[data-panel="audio"]');
  const interfacePanel = overlay.querySelector('[data-panel="interface"]');
  const panels = [mainPanel, audioPanel, interfacePanel];

  overlay.querySelector('[data-action="return-to-game"]').addEventListener('click', close);
  overlay.querySelector('[data-action="open-audio"]').addEventListener('click', () => showPanel(audioPanel));
  overlay.querySelector('[data-action="open-interface"]').addEventListener('click', () => showPanel(interfacePanel));
  for (const backButton of overlay.querySelectorAll('[data-action="back-to-menu"]')) {
    backButton.addEventListener('click', () => showPanel(mainPanel));
  }
  overlay.querySelector('[data-action="log-out"]').addEventListener('click', () => {
    close();
    onLogOut();
  });

  const volumes = audio.getVolumes();
  connectVolumeSlider(audioPanel.querySelector('[name="music"]'), volumes.music, audio.setMusicVolume);
  connectVolumeSlider(audioPanel.querySelector('[name="sfx"]'), volumes.sfx, audio.setSfxVolume);

  for (const checkbox of interfacePanel.querySelectorAll('input[type="checkbox"]')) {
    connectSettingCheckbox(checkbox, interfaceSettings);
  }

  function showPanel(panel) {
    for (const candidate of panels) candidate.hidden = candidate !== panel;
  }

  function open() {
    showPanel(mainPanel);
    overlay.hidden = false;
  }

  function close() {
    overlay.hidden = true;
  }

  return { open, close, isOpen: () => !overlay.hidden };
}

// The checkbox name is the setting name. A key can change the setting too, so the checkbox follows every change.
function connectSettingCheckbox(checkbox, interfaceSettings) {
  checkbox.checked = interfaceSettings.get(checkbox.name);
  checkbox.addEventListener('change', () => interfaceSettings.set(checkbox.name, checkbox.checked));
  interfaceSettings.onChange((name, value) => {
    if (name === checkbox.name) checkbox.checked = value;
  });
}

function connectVolumeSlider(slider, initialVolume, setVolume) {
  const percentage = slider.closest('.volume-control').querySelector('output');

  function showPercentage() {
    percentage.textContent = `${slider.value}%`;
  }

  slider.value = String(Math.round(initialVolume * 100));
  showPercentage();
  slider.addEventListener('input', () => {
    setVolume(Number(slider.value) / 100);
    showPercentage();
  });
}
