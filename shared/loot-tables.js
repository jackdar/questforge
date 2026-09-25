// A player must stand this close to a corpse to loot it. The server checks it, and the client closes the window.
export const LOOT_RANGE = 5;

// Each entry drops on its own roll, so one corpse can drop several items or none.
// A drop chance is a fraction from 0 to 1.
export const LOOT_TABLES = {
  giantCaveSpider: [
    { itemId: 'spiderSilk', dropChance: 0.6, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'venomSac', dropChance: 0.4, minQuantity: 1, maxQuantity: 1 },
  ],
  // The spiderlings that the Broodmother calls drop nothing, so the fight does not flood the party with loot.
  spiderling: [],
  broodmother: [
    { itemId: 'spiderSilk', dropChance: 1, minQuantity: 3, maxQuantity: 5 },
    { itemId: 'venomSac', dropChance: 1, minQuantity: 2, maxQuantity: 3 },
    { itemId: 'broodmothersEye', dropChance: 0.5, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'silkwovenCloak', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
  ],
  banditThug: [
    { itemId: 'tatteredBandana', dropChance: 0.5, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'roughLeatherScraps', dropChance: 0.4, minQuantity: 1, maxQuantity: 3 },
    { itemId: 'linenCloth', dropChance: 0.25, minQuantity: 1, maxQuantity: 2 },
  ],
  banditLeader: [
    { itemId: 'roughLeatherScraps', dropChance: 0.8, minQuantity: 2, maxQuantity: 4 },
    { itemId: 'linenCloth', dropChance: 0.5, minQuantity: 1, maxQuantity: 3 },
    { itemId: 'banditLeadersBlade', dropChance: 0.25, minQuantity: 1, maxQuantity: 1 },
  ],
  alphaWolf: [
    { itemId: 'wolfPelt', dropChance: 0.9, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'wolfFang', dropChance: 0.6, minQuantity: 2, maxQuantity: 3 },
    { itemId: 'wolfMeat', dropChance: 0.6, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'wornLeatherBoots', dropChance: 0.08, minQuantity: 1, maxQuantity: 1 },
  ],
  greyWolf: [
    { itemId: 'wolfFang', dropChance: 0.5, minQuantity: 1, maxQuantity: 2 },
    { itemId: 'wolfPelt', dropChance: 0.4, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'wolfMeat', dropChance: 0.3, minQuantity: 1, maxQuantity: 1 },
    { itemId: 'wornLeatherBoots', dropChance: 0.02, minQuantity: 1, maxQuantity: 1 },
  ],
};

// Each coin drops on its own roll, so a corpse can drop copper, silver, and gold together, or no money at all.
// The amount is a number of that coin.
export const MONEY_TABLES = {
  giantCaveSpider: [
    { coin: 'copper', dropChance: 0.8, minAmount: 10, maxAmount: 30 },
    { coin: 'silver', dropChance: 0.1, minAmount: 1, maxAmount: 1 },
  ],
  spiderling: [],
  broodmother: [
    { coin: 'copper', dropChance: 1, minAmount: 50, maxAmount: 99 },
    { coin: 'silver', dropChance: 1, minAmount: 5, maxAmount: 10 },
    { coin: 'gold', dropChance: 0.2, minAmount: 1, maxAmount: 1 },
  ],
  alphaWolf: [
    { coin: 'copper', dropChance: 1, minAmount: 15, maxAmount: 40 },
    { coin: 'silver', dropChance: 0.25, minAmount: 1, maxAmount: 2 },
    { coin: 'gold', dropChance: 0.01, minAmount: 1, maxAmount: 1 },
  ],
  banditThug: [
    { coin: 'copper', dropChance: 0.8, minAmount: 5, maxAmount: 20 },
    { coin: 'silver', dropChance: 0.08, minAmount: 1, maxAmount: 1 },
    { coin: 'gold', dropChance: 0.003, minAmount: 1, maxAmount: 1 },
  ],
  banditLeader: [
    { coin: 'copper', dropChance: 1, minAmount: 30, maxAmount: 70 },
    { coin: 'silver', dropChance: 0.7, minAmount: 2, maxAmount: 5 },
    { coin: 'gold', dropChance: 0.05, minAmount: 1, maxAmount: 1 },
  ],
  greyWolf: [
    { coin: 'copper', dropChance: 0.7, minAmount: 1, maxAmount: 8 },
    { coin: 'silver', dropChance: 0.02, minAmount: 1, maxAmount: 1 },
    { coin: 'gold', dropChance: 0.001, minAmount: 1, maxAmount: 1 },
  ],
};
