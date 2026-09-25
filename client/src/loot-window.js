import { ITEMS } from 'questforge-shared/items.js';
import { makeDraggable } from './draggable-window.js';
import { renderMoney } from './money-display.js';

export function createLootWindow({ onTake, onTakeMoney, storage }) {
  const panel = document.getElementById('loot-window');
  const list = panel.querySelector('.loot-list');
  const dragging = makeDraggable(panel, panel.querySelector('.loot-header'), { storage, storageKey: 'loot' });
  let corpseId = null;

  panel.querySelector('[data-action="close-loot"]').addEventListener('click', close);

  // As in WoW, the money is the first line of the loot.
  function show(entityId, drops, copper) {
    if (drops.length === 0 && copper === 0) {
      close();
      return;
    }
    corpseId = entityId;
    const moneyButtons = copper > 0 ? [createMoneyButton(copper)] : [];
    list.replaceChildren(...moneyButtons, ...drops.map(createDropButton));
    panel.hidden = false;
    dragging.keepOnScreen();
  }

  function createMoneyButton(copper) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'loot-item';
    const coins = document.createElement('span');
    renderMoney(coins, copper);
    button.append(coins);
    button.addEventListener('click', () => onTakeMoney(corpseId));
    return button;
  }

  function createDropButton({ slot, itemId, quantity }) {
    const item = ITEMS[itemId];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'loot-item';

    const name = document.createElement('span');
    name.className = 'item-name';
    name.dataset.quality = item.quality;
    name.textContent = item.name;
    button.append(name);

    if (quantity > 1) {
      const quantityElement = document.createElement('span');
      quantityElement.className = 'loot-item-quantity';
      quantityElement.textContent = String(quantity);
      button.append(quantityElement);
    }

    button.addEventListener('click', () => onTake(corpseId, slot));
    return button;
  }

  function close() {
    corpseId = null;
    list.replaceChildren();
    panel.hidden = true;
  }

  return { show, close, isOpen: () => !panel.hidden, getCorpseId: () => corpseId };
}
