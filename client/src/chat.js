import { CHAT_MAX_LENGTH } from 'questforge-shared/chat-rules.js';

const MAX_VISIBLE_LINES = 50;

export function createChat(onSend) {
  const container = document.getElementById('chat');
  const log = container.querySelector('.chat-log');
  const form = container.querySelector('.chat-form');
  const input = form.elements.message;
  input.maxLength = CHAT_MAX_LENGTH;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text) onSend(text);
    closeInput();
  });

  // The game ignores keys typed into the input, so Esc here only closes the chat and does not open the game menu.
  input.addEventListener('keydown', (event) => {
    if (event.code === 'Escape') closeInput();
  });

  function openInput() {
    form.hidden = false;
    input.focus();
  }

  function closeInput() {
    input.value = '';
    input.blur();
    form.hidden = true;
  }

  // The text goes into the page as plain text, so a message cannot add HTML to the screen of another player.
  function addMessage({ senderName, text }) {
    const sender = document.createElement('span');
    sender.className = 'chat-sender';
    sender.textContent = `[${senderName}]:`;
    addLine('chat-message', sender, ` ${text}`);
  }

  function addSystemMessage(text) {
    addLine('chat-system', text);
  }

  function addLine(className, ...content) {
    const line = document.createElement('div');
    line.className = `chat-line ${className}`;
    line.append(...content);
    log.append(line);
    while (log.children.length > MAX_VISIBLE_LINES) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function show() {
    container.hidden = false;
  }

  function hide() {
    closeInput();
    log.replaceChildren();
    container.hidden = true;
  }

  return { show, hide, openInput, addMessage, addSystemMessage, isInputOpen: () => !form.hidden };
}
