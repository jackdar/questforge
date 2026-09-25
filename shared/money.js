// All money is a whole number of copper. The game shows it as gold, silver, and copper, as in WoW.
export const COPPER_PER_SILVER = 100;
export const COPPER_PER_GOLD = 100 * COPPER_PER_SILVER;
export const COIN_VALUES = { gold: COPPER_PER_GOLD, silver: COPPER_PER_SILVER, copper: 1 };

export function splitMoney(totalCopper) {
  return {
    gold: Math.floor(totalCopper / COPPER_PER_GOLD),
    silver: Math.floor((totalCopper % COPPER_PER_GOLD) / COPPER_PER_SILVER),
    copper: totalCopper % COPPER_PER_SILVER,
  };
}

// For example "1 Gold 5 Copper". A coin with no amount is left out, and no money shows as "0 Copper".
export function formatMoney(totalCopper) {
  const coins = splitMoney(totalCopper);
  const parts = [
    [coins.gold, 'Gold'],
    [coins.silver, 'Silver'],
    [coins.copper, 'Copper'],
  ]
    .filter(([amount]) => amount > 0)
    .map(([amount, name]) => `${amount} ${name}`);
  return parts.length > 0 ? parts.join(' ') : '0 Copper';
}
