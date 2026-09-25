// Quality sets the colour of an item name, as in WoW: grey for poor, white for common, green for uncommon, and blue
// for rare.
export const ITEM_QUALITIES = ['poor', 'common', 'uncommon', 'rare'];

// Prices are in copper. A shop sells an item for its buy price, and buys it back for its sell price.
// As in WoW, an item sells for about a quarter of its buy price. An item that no shop sells has no buy price.
export const ITEMS = {
  wolfFang: { id: 'wolfFang', name: 'Chipped Wolf Fang', quality: 'poor', maxStack: 20, sellPrice: 4 },
  wolfPelt: { id: 'wolfPelt', name: 'Wolf Pelt', quality: 'common', maxStack: 20, sellPrice: 15 },
  wolfMeat: { id: 'wolfMeat', name: 'Stringy Wolf Meat', quality: 'common', maxStack: 20, sellPrice: 8 },
  wornLeatherBoots: {
    id: 'wornLeatherBoots',
    name: 'Worn Leather Boots',
    quality: 'uncommon',
    maxStack: 1,
    buyPrice: 3_00,
    sellPrice: 75,
  },
  tatteredBandana: {
    id: 'tatteredBandana',
    name: 'Tattered Bandana',
    quality: 'poor',
    maxStack: 20,
    sellPrice: 9,
  },
  roughLeatherScraps: {
    id: 'roughLeatherScraps',
    name: 'Rough Leather Scraps',
    quality: 'common',
    maxStack: 20,
    sellPrice: 12,
  },
  banditLeadersBlade: {
    id: 'banditLeadersBlade',
    name: "Bandit Leader's Blade",
    quality: 'uncommon',
    maxStack: 1,
    sellPrice: 2_50,
  },
  redpineMilitiaCloak: {
    id: 'redpineMilitiaCloak',
    name: 'Redpine Militia Cloak',
    quality: 'uncommon',
    maxStack: 1,
    sellPrice: 1_50,
  },
  spiderSilk: { id: 'spiderSilk', name: 'Spider Silk', quality: 'common', maxStack: 20, sellPrice: 12 },
  venomSac: { id: 'venomSac', name: 'Venom Sac', quality: 'common', maxStack: 20, sellPrice: 18 },
  broodmothersEye: {
    id: 'broodmothersEye',
    name: "Broodmother's Eye",
    quality: 'uncommon',
    maxStack: 1,
    sellPrice: 3_00,
  },
  silkwovenCloak: { id: 'silkwovenCloak', name: 'Silkwoven Cloak', quality: 'rare', maxStack: 1, sellPrice: 8_00 },
  fangOfTheBroodmother: {
    id: 'fangOfTheBroodmother',
    name: 'Fang of the Broodmother',
    quality: 'rare',
    maxStack: 1,
    sellPrice: 10_00,
  },
  linenCloth: { id: 'linenCloth', name: 'Linen Cloth', quality: 'common', maxStack: 20, buyPrice: 20, sellPrice: 5 },
  coarseThread: {
    id: 'coarseThread',
    name: 'Coarse Thread',
    quality: 'common',
    maxStack: 20,
    buyPrice: 10,
    sellPrice: 2,
  },
};

