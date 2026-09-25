import { ITEMS } from 'questforge-shared/items.js';
import { NPCS } from 'questforge-shared/npcs.js';
import { SHOPS } from 'questforge-shared/shops.js';
import { makeDraggable } from './draggable-window.js';
import { renderMoney } from './money-display.js';

// The Buy tab sells the shop items: a click buys one. The Buyback tab lists the sales of this session: a click buys
// the sale back. The server checks the money and the bag space.
export function createShopWindow({ storage, onBuy, onBuyBack }) {
  const panel = document.getElementById('shop-window');
  const title = panel.querySelector('.shop-title');
  const list = panel.querySelector('.shop-list');
  const tabs = panel.querySelectorAll('[data-tab]');
  const dragging = makeDraggable(panel, panel.querySelector('.shop-header'), { storage, storageKey: 'shop' });
  let npcId = null;
  let activeTab = 'buy';
  let sales = [];

  panel.querySelector('[data-action="close-shop"]').addEventListener('click', close);
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      render();
    });
  }

  function open(newNpcId) {
    npcId = newNpcId;
    activeTab = 'buy';
    title.textContent = NPCS[npcId].name;
    render();
    panel.hidden = false;
    dragging.keepOnScreen();
  }

  function setBuyback(newSales) {
    sales = newSales;
    if (npcId) render();
  }

  function render() {
    for (const tab of tabs) tab.classList.toggle('active', tab.dataset.tab === activeTab);
    if (activeTab === 'buy') {
      list.replaceChildren(...SHOPS[NPCS[npcId].shopId].itemIds.map(createItemButton));
      return;
    }
    if (sales.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shop-empty';
      empty.textContent = 'Nothing to buy back.';
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...sales.map(createSaleButton));
  }

  function createSaleButton(sale) {
    const button = createPricedButton(sale.itemId, sale.price, sale.quantity);
    button.addEventListener('click', () => onBuyBack(npcId, sale.id));
    return button;
  }

  function createItemButton(itemId) {
    const button = createPricedButton(itemId, ITEMS[itemId].buyPrice, 1);
    button.addEventListener('click', () => onBuy(npcId, itemId));
    return button;
  }

  function createPricedButton(itemId, priceInCopper, quantity) {
    const item = ITEMS[itemId];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-item';

    const name = document.createElement('span');
    name.className = 'item-name';
    name.dataset.quality = item.quality;
    name.textContent = quantity > 1 ? `${item.name} x${quantity}` : item.name;
    const price = document.createElement('span');
    renderMoney(price, priceInCopper);
    button.append(name, price);
    return button;
  }

  function close() {
    npcId = null;
    panel.hidden = true;
  }

  return { open, close, setBuyback, isOpen: () => !panel.hidden, getNpcId: () => npcId };
}
