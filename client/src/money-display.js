import { splitMoney } from 'questforge-shared/money.js';

// Shows money as coloured coin amounts, for example "1g 5c". A coin with no amount is left out,
// and no money shows as "0c".
export function renderMoney(container, totalCopper) {
  const coins = splitMoney(totalCopper);
  const shownCoins = ['gold', 'silver', 'copper'].filter((coin) => coins[coin] > 0);
  if (shownCoins.length === 0) shownCoins.push('copper');

  container.replaceChildren(
    ...shownCoins.map((coin) => {
      const amount = document.createElement('span');
      amount.className = `coin coin-${coin}`;
      amount.textContent = `${coins[coin]}${coin[0]}`;
      return amount;
    }),
  );
}
