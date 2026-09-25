import { CHAT_MAX_LENGTH } from 'questforge-shared/chat-rules.js';
import { formatMoney } from 'questforge-shared/money.js';

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

  function addPartyMessage(text) {
    addLine('chat-party', text);
  }

  function addLootMessage(item, quantity) {
    addItemLine('You receive loot: ', item, quantity);
  }

  function addMoneyLootedMessage(copper) {
    addLine('chat-loot', `You loot ${formatMoney(copper)}.`);
  }

  function addItemBoughtMessage(item) {
    addItemLine('You buy ', item, 1);
  }

  function addItemSoldMessage({ name, quality }, quantity, copper) {
    const itemName = document.createElement('span');
    itemName.className = 'item-name';
    itemName.dataset.quality = quality;
    itemName.textContent = `[${name}]`;
    const amount = quantity > 1 ? ` x${quantity}` : '';
    addLine('chat-loot', 'You sell ', itemName, `${amount} for ${formatMoney(copper)}.`);
  }

  function addQuestRewardMessage(item, quantity) {
    addItemLine('You receive item: ', item, quantity);
  }

  function addQuestCompletedMessage(questName) {
    addLine('chat-quest', `${questName} completed.`);
  }

  function addExperienceMessage(xp) {
    addLine('chat-quest', `You gain ${xp} experience.`);
  }

  function addLevelUpMessage(level) {
    addLine('chat-quest', `You have reached level ${level}!`);
  }

  function addItemLine(prefix, { name, quality }, quantity) {
    const itemName = document.createElement('span');
    itemName.className = 'item-name';
    itemName.dataset.quality = quality;
    itemName.textContent = `[${name}]`;
    addLine('chat-loot', prefix, itemName, quantity > 1 ? ` x${quantity}.` : '.');
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

  return {
    show,
    hide,
    openInput,
    addMessage,
    addSystemMessage,
    addPartyMessage,
    addLootMessage,
    addMoneyLootedMessage,
    addItemBoughtMessage,
    addItemSoldMessage,
    addQuestRewardMessage,
    addQuestCompletedMessage,
    addExperienceMessage,
    addLevelUpMessage,
    isInputOpen: () => !form.hidden,
  };
}
