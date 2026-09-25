import { ITEMS } from 'questforge-shared/items.js';
import { formatMoney } from 'questforge-shared/money.js';
import { BAG_SLOT_COUNT } from 'questforge-shared/inventory-rules.js';
import { makeDraggable } from './draggable-window.js';
import { renderMoney } from './money-display.js';

// The player drags a stack onto another slot to move it. The server decides the result and sends the new bags.
// A click on a stack goes to onStackClick, which sells the stack while a shop is open.
export function createBagWindow({ storage, onMove, onStackClick }) {
  const panel = document.getElementById('bag-window');
  const slots = panel.querySelector('.bag-slots');
  const money = panel.querySelector('.bag-money');
  const dragging = makeDraggable(panel, panel.querySelector('.bag-header'), { storage, storageKey: 'bags' });
  let stacksBySlot = new Map();

  panel.querySelector('[data-action="close-bags"]').addEventListener('click', close);
  render();

  function setMoney(copper) {
    renderMoney(money, copper);
  }

  function setStacks(stacks) {
    stacksBySlot = new Map(stacks.map((stack) => [stack.slot, stack]));
    render();
  }

  function render() {
    slots.replaceChildren(...Array.from({ length: BAG_SLOT_COUNT }, (_, slot) => createSlot(slot)));
  }

  function createSlot(slotNumber) {
    const slot = document.createElement('div');
    slot.className = 'bag-slot';
    acceptDrops(slot, slotNumber);

    const stack = stacksBySlot.get(slotNumber);
    if (!stack) return slot;

    const item = ITEMS[stack.itemId];
    slot.dataset.quality = item.quality;
    slot.title = `${item.name}\nSells for ${formatMoney(item.sellPrice)} each`;
    slot.draggable = true;
    slot.addEventListener('click', () => onStackClick(slotNumber));
    slot.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(slotNumber));
      event.dataTransfer.effectAllowed = 'move';
      slot.classList.add('dragging');
    });
    slot.addEventListener('dragend', () => slot.classList.remove('dragging'));

    const name = document.createElement('span');
    name.className = 'item-name';
    name.dataset.quality = item.quality;
    name.textContent = item.name;
    slot.append(name);

    if (stack.quantity > 1) {
      const quantity = document.createElement('span');
      quantity.className = 'bag-slot-quantity';
      quantity.textContent = String(stack.quantity);
      slot.append(quantity);
    }
    return slot;
  }

  function acceptDrops(slot, slotNumber) {
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drop-target');
      const fromSlot = Number(event.dataTransfer.getData('text/plain'));
      if (Number.isInteger(fromSlot) && fromSlot !== slotNumber) onMove(fromSlot, slotNumber);
    });
  }

  function toggle() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) dragging.keepOnScreen();
  }

  function open() {
    panel.hidden = false;
    dragging.keepOnScreen();
  }

  function close() {
    panel.hidden = true;
  }

  function clear() {
    close();
    setStacks([]);
    setMoney(0);
  }

  return { setStacks, setMoney, toggle, open, close, clear, isOpen: () => !panel.hidden };
}
