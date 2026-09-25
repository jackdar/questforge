import { ITEMS } from './items.js';

export const BAG_SLOT_COUNT = 16;

// A stack is { slot, itemId, quantity }. These functions return new stacks and never change the stacks they get.

// As in WoW, a new item first fills stacks of the same item that have room, then the lowest empty slots.
// The item goes into the bags whole or not at all.
export function addToBags(stacks, { itemId, quantity }) {
  const { maxStack } = ITEMS[itemId];
  const newStacks = stacks.map((stack) => ({ ...stack }));
  let remaining = quantity;

  for (const stack of newStacks) {
    if (stack.itemId !== itemId || remaining === 0) continue;
    const added = Math.min(maxStack - stack.quantity, remaining);
    stack.quantity += added;
    remaining -= added;
  }

  const usedSlots = new Set(newStacks.map((stack) => stack.slot));
  for (let slot = 0; slot < BAG_SLOT_COUNT && remaining > 0; slot++) {
    if (usedSlots.has(slot)) continue;
    const added = Math.min(maxStack, remaining);
    newStacks.push({ slot, itemId, quantity: added });
    remaining -= added;
  }

  if (remaining > 0) return { error: 'Your bags are full.' };
  return { stacks: sortBySlot(newStacks) };
}

// A stack moved onto an empty slot moves there. Onto the same item, it fills that stack and keeps the rest.
// Onto another item, the two stacks swap places.
export function moveStack(stacks, fromSlot, toSlot) {
  if (![fromSlot, toSlot].every((slot) => Number.isInteger(slot) && slot >= 0 && slot < BAG_SLOT_COUNT)) {
    return { error: 'That bag slot does not exist.' };
  }
  const moving = stacks.find((stack) => stack.slot === fromSlot);
  if (!moving) return { error: 'That bag slot is empty.' };
  if (fromSlot === toSlot) return { stacks: stacks.map((stack) => ({ ...stack })) };

  const target = stacks.find((stack) => stack.slot === toSlot);
  const others = stacks.filter((stack) => stack !== moving && stack !== target).map((stack) => ({ ...stack }));

  if (!target) return { stacks: sortBySlot([...others, { ...moving, slot: toSlot }]) };
  if (target.itemId !== moving.itemId) {
    return { stacks: sortBySlot([...others, { ...moving, slot: toSlot }, { ...target, slot: fromSlot }]) };
  }

  const added = Math.min(ITEMS[target.itemId].maxStack - target.quantity, moving.quantity);
  const merged = [...others, { ...target, quantity: target.quantity + added }];
  if (moving.quantity > added) merged.push({ ...moving, quantity: moving.quantity - added });
  return { stacks: sortBySlot(merged) };
}

// The items leave the stacks in the highest slots first, so the stacks in the lowest slots stay.
export function removeFromBags(stacks, { itemId, quantity }) {
  const newStacks = stacks.map((stack) => ({ ...stack }));
  let remaining = quantity;
  for (const stack of [...newStacks].reverse()) {
    if (stack.itemId !== itemId || remaining === 0) continue;
    const removed = Math.min(stack.quantity, remaining);
    stack.quantity -= removed;
    remaining -= removed;
  }

  if (remaining > 0) return { error: `You do not have enough ${ITEMS[itemId].name}.` };
  return { stacks: newStacks.filter((stack) => stack.quantity > 0) };
}

function sortBySlot(stacks) {
  return stacks.sort((a, b) => a.slot - b.slot);
}
