import { applyBuyback, applyPurchase, applySale } from 'questforge-shared/shop-rules.js';
import { runLockedForCharacter } from './character-lock.js';
import { saveStacks, selectStacks } from './inventory-store.js';
import { saveCopper, selectCopper } from './character-store.js';

export function createShopStore(pool) {
  async function buyItem(characterId, shopId, itemId) {
    return changeBagsAndMoney(characterId, (wallet) => applyPurchase(wallet, shopId, itemId));
  }

  async function sellStack(characterId, slot) {
    return changeBagsAndMoney(characterId, (wallet) => applySale(wallet, slot));
  }

  async function buyBack(characterId, sale) {
    return changeBagsAndMoney(characterId, (wallet) => applyBuyback(wallet, sale));
  }

  // The money and the bags change together, so a failed save cannot take the money without giving the item.
  // The change gets { stacks, copper } and returns the new { stacks, copper }, or an error that saves nothing.
  async function changeBagsAndMoney(characterId, change) {
    return runLockedForCharacter(pool, characterId, async (client) => {
      const stacks = await selectStacks(client, characterId);
      const copper = await selectCopper(client, characterId);
      const result = change({ stacks, copper });
      if (result.error) return result;

      await saveStacks(client, characterId, result.stacks);
      await saveCopper(client, characterId, result.copper);
      return result;
    });
  }

  return { buyItem, sellStack, buyBack };
}
