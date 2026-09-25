import { ITEMS } from './items.js';
import { SHOPS } from './shops.js';
import { addToBags } from './inventory-rules.js';

// A purchase buys one of the item. Returns the new stacks and money, or an error that changes nothing.
export function applyPurchase({ stacks, copper }, shopId, itemId) {
  if (!SHOPS[shopId]?.itemIds.includes(itemId)) return { error: 'That item is not for sale here.' };
  const price = ITEMS[itemId].buyPrice;
  if (copper < price) return { error: 'You do not have enough money.' };

  const result = addToBags(stacks, { itemId, quantity: 1 });
  if (result.error) return result;
  return { stacks: result.stacks, copper: copper - price };
}

// As in WoW, the buyback list keeps the last sales of this session, and the oldest sale drops off first.
export const BUYBACK_SIZE = 12;

// A sale sells the whole stack in one bag slot. Returns the new stacks and money, and the sale for the buyback list.
export function applySale({ stacks, copper }, slot) {
  const stack = stacks.find((candidate) => candidate.slot === slot);
  if (!stack) return { error: 'That bag slot is empty.' };
  const price = ITEMS[stack.itemId].sellPrice * stack.quantity;
  if (price === 0) return { error: 'The trader does not want that.' };

  return {
    stacks: stacks.filter((candidate) => candidate !== stack),
    copper: copper + price,
    sale: { itemId: stack.itemId, quantity: stack.quantity, price },
  };
}

// Buying back a sale costs what the trader paid for it.
export function applyBuyback({ stacks, copper }, sale) {
  if (copper < sale.price) return { error: 'You do not have enough money.' };
  const result = addToBags(stacks, { itemId: sale.itemId, quantity: sale.quantity });
  if (result.error) return result;
  return { stacks: result.stacks, copper: copper - sale.price };
}

export function addToBuyback(buyback, sale) {
  return [sale, ...buyback].slice(0, BUYBACK_SIZE);
}
