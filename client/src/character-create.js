import { FACTIONS } from 'questforge-shared/factions.js';
import { validateCharacterName, validateFaction } from 'questforge-shared/character-rules.js';
import { createCharacter } from './api-requests.js';
import { createModelPreview } from './model-preview.js';

export function createCharacterCreateScreen({ onCreated, onBack }) {
  const overlay = document.getElementById('character-create');
  const choices = overlay.querySelector('.faction-choices');
  const form = overlay.querySelector('form');
  const nameInput = form.elements.name;
  const errorElement = overlay.querySelector('.form-error');
  let selectedFaction = null;
  let previews = [];

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });
  overlay.querySelector('[data-action="back"]').addEventListener('click', () => {
    hide();
    onBack();
  });

  function show() {
    overlay.hidden = false;
    selectedFaction = null;
    nameInput.value = '';
    errorElement.textContent = '';
    choices.replaceChildren(...Object.values(FACTIONS).map(createFactionButton));
    // A preview needs its canvas on the page first, because it reads the canvas size.
    previews = [...choices.querySelectorAll('.faction-preview')].map((canvas) =>
      createModelPreview(canvas, canvas.dataset.faction),
    );
    nameInput.focus();
  }

  function hide() {
    overlay.hidden = true;
    for (const preview of previews) preview.dispose();
    previews = [];
  }

  function createFactionButton(faction) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'faction-button';
    button.dataset.faction = faction.id;

    const canvas = document.createElement('canvas');
    canvas.className = 'faction-preview';
    canvas.dataset.faction = faction.id;

    const label = document.createElement('span');
    label.textContent = faction.name;

    button.append(canvas, label);
    button.addEventListener('click', () => {
      selectedFaction = faction.id;
      for (const choice of choices.children) choice.classList.toggle('selected', choice === button);
    });
    return button;
  }

  async function submit() {
    const problem = validateFaction(selectedFaction) ?? validateCharacterName(nameInput.value);
    if (problem) {
      errorElement.textContent = problem;
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const result = await createCharacter(nameInput.value, selectedFaction);
    submitButton.disabled = false;

    if (!result.ok) {
      errorElement.textContent = result.error;
      return;
    }
    hide();
    onCreated(result.character);
  }

  return { show };
}
