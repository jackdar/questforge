import { FACTIONS } from 'questforge-shared/factions.js';
import { fetchCharacters } from './api-requests.js';

export function createCharacterSelectScreen({ onEnterWorld, onCreateCharacter, onLogout }) {
  const overlay = document.getElementById('character-select');
  const list = overlay.querySelector('.character-list');
  const emptyMessage = overlay.querySelector('.character-list-empty');
  const enterButton = overlay.querySelector('[data-action="enter-world"]');
  const errorElement = overlay.querySelector('.form-error');
  let characters = [];
  let selectedCharacterId = null;

  enterButton.addEventListener('click', enterWorld);
  overlay.querySelector('[data-action="create-character"]').addEventListener('click', () => {
    overlay.hidden = true;
    onCreateCharacter();
  });
  overlay.querySelector('[data-action="logout"]').addEventListener('click', onLogout);

  async function show({ selectCharacterId = null, error = '' } = {}) {
    overlay.hidden = false;
    errorElement.textContent = error;

    const result = await fetchCharacters();
    if (!result.ok) errorElement.textContent = result.error;
    characters = result.ok ? result.characters : [];
    selectedCharacterId = selectCharacterId ?? characters[0]?.id ?? null;
    render();
  }

  function setAccount(account) {
    overlay.querySelector('.logged-in-as').textContent = `Logged in as ${account.username}`;
  }

  function render() {
    list.replaceChildren(...characters.map(createCharacterEntry));
    emptyMessage.hidden = characters.length > 0;
    enterButton.disabled = selectedCharacterId === null;
  }

  function createCharacterEntry(character) {
    const entry = document.createElement('button');
    entry.className = 'character-entry';
    entry.classList.toggle('selected', character.id === selectedCharacterId);

    const name = document.createElement('span');
    name.className = 'character-name';
    name.textContent = character.name;

    const details = document.createElement('span');
    details.className = 'character-details';
    details.textContent = `Level ${character.level} · ${FACTIONS[character.faction]?.name ?? character.faction}`;

    entry.append(name, details);
    entry.addEventListener('click', () => {
      selectedCharacterId = character.id;
      render();
    });
    entry.addEventListener('dblclick', enterWorld);
    return entry;
  }

  function enterWorld() {
    const character = characters.find((candidate) => candidate.id === selectedCharacterId);
    if (!character) return;
    overlay.hidden = true;
    onEnterWorld(character);
  }

  return { show, setAccount };
}
