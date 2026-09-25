import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES } from 'questforge-shared/creatures.js';
import { LOOT_RANGE, LOOT_TABLES, MONEY_TABLES } from 'questforge-shared/loot-tables.js';
import { COIN_VALUES } from 'questforge-shared/money.js';
import { SPELLS } from 'questforge-shared/spells.js';
import { createWorldState } from '../src/world-state.js';
import { createCombat } from '../src/combat.js';
import { createLoot, rollLoot, rollMoney } from '../src/loot.js';

// Players spawn at the origin facing +z, so this wolf is in front of them and in spell range.
const WOLF_IN_SPELL_RANGE = { x: 0, z: 10, rotation: 0 };
const ICE_LANCE_TRAVEL_MS = Math.ceil((WOLF_IN_SPELL_RANGE.z / SPELLS.iceLance.projectileSpeed) * 1000);
// This corpse lies inside loot range of the player spawn.
const WOLF_IN_LOOT_RANGE = { x: 0, z: 3, rotation: 0 };
const KILL_IN_LOOT_RANGE_MS = Math.ceil((WOLF_IN_LOOT_RANGE.z / SPELLS.iceLance.projectileSpeed) * 1000);
const alwaysDrops = () => 0;
// With every roll at 0, every coin of the wolf money table drops at its lowest amount.
const LOWEST_WOLF_MONEY = MONEY_TABLES.greyWolf.reduce(
  (copper, { coin, minAmount }) => copper + minAmount * COIN_VALUES[coin],
  0,
);
const neverDrops = () => 0.99;
const table = [
  { itemId: 'wolfFang', dropChance: 0.5, minQuantity: 1, maxQuantity: 3 },
  { itemId: 'wolfPelt', dropChance: 0.2, minQuantity: 1, maxQuantity: 1 },
];

test('an entry drops when its roll is below its drop chance', () => {
  const rolls = [0.49, 0, 0.2];

  assert.deepEqual(rollLoot(table, () => rolls.shift()), [{ itemId: 'wolfFang', quantity: 1 }]);
});

test('an entry does not drop when its roll is at its drop chance or above', () => {
  assert.deepEqual(rollLoot(table, () => 0.5), []);
});

test('a dropped entry gives a quantity from its minimum to its maximum', () => {
  const highestRolls = [0, 0.999];

  const lowest = rollLoot([table[0]], () => 0);
  const highest = rollLoot([table[0]], () => highestRolls.shift());

  assert.deepEqual(lowest, [{ itemId: 'wolfFang', quantity: 1 }]);
  assert.deepEqual(highest, [{ itemId: 'wolfFang', quantity: 3 }]);
});

test('the first player to damage a wolf gets its loot, even when another player kills it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_SPELL_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);
  world.changeHealth('wolf', 1 - world.getEntity('wolf').health);
  combat.startCast('bob', 'iceLance', 'wolf', ICE_LANCE_TRAVEL_MS);
  combat.tick(2 * ICE_LANCE_TRAVEL_MS);

  assert.deepEqual(world.getEntity('wolf').lootableBy, ['alice']);
  assert.deepEqual(
    loot.getCorpseLoot('wolf'),
    LOOT_TABLES.greyWolf.map(({ itemId, minQuantity }, slot) => ({ slot, itemId, quantity: minQuantity })),
  );
});

test('a corpse that drops nothing cannot be looted', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_SPELL_RANGE);
  const loot = createLoot(world, { random: neverDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  world.changeHealth('wolf', -CREATURES.wolf.maxHealth + 1);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);

  assert.equal(world.getEntity('wolf').health, 0);
  assert.deepEqual(world.getEntity('wolf').lootableBy, []);
  assert.deepEqual(loot.getCorpseLoot('wolf'), []);
});

test('a wolf that evades loses its tag, so the next player to damage it tags it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_SPELL_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);
  world.setEvading('wolf', true);
  loot.tick();
  world.setEvading('wolf', false);
  world.changeHealth('wolf', 1 - world.getEntity('wolf').health);
  combat.startCast('bob', 'iceLance', 'wolf', ICE_LANCE_TRAVEL_MS);
  combat.tick(2 * ICE_LANCE_TRAVEL_MS);

  assert.deepEqual(world.getEntity('wolf').lootableBy, ['bob']);
});

test('a respawned wolf has no loot and no tag', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_SPELL_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  const respawnTime = ICE_LANCE_TRAVEL_MS + CREATURES.wolf.respawnDelayMs;

  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);
  combat.tick(respawnTime);
  const lootAfterRespawn = loot.getCorpseLoot('wolf');
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('bob', 'iceLance', 'wolf', respawnTime);
  combat.tick(respawnTime + ICE_LANCE_TRAVEL_MS);

  assert.deepEqual(lootAfterRespawn, []);
  assert.deepEqual(world.getEntity('wolf').lootableBy, ['bob']);
});

test('a training dummy never drops loot', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', WOLF_IN_SPELL_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  world.changeHealth('dummy', -99);
  combat.startCast('alice', 'iceLance', 'dummy', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);

  assert.equal(world.getEntity('dummy').health, 0);
  assert.deepEqual(loot.getCorpseLoot('dummy'), []);
});

test('the tagging player next to the corpse sees its drops', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  assert.deepEqual(loot.openLoot('alice', 'wolf'), { drops: loot.getCorpseLoot('wolf'), copper: LOWEST_WOLF_MONEY });
  assert.equal(loot.getCorpseLoot('wolf').length, LOOT_TABLES.greyWolf.length);
});

test('a player who did not tag the corpse cannot open or take its loot', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  assert.deepEqual(loot.openLoot('bob', 'wolf'), { error: 'That corpse has no loot for you.' });
  assert.deepEqual(loot.takeDrop('bob', 'wolf', 0), { error: 'That corpse has no loot for you.' });
});

test('the tagging player cannot open the loot from beyond loot range', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  world.movePlayer('alice', { x: 0, y: 0, z: WOLF_IN_LOOT_RANGE.z - LOOT_RANGE - 1, rotation: 0 });

  assert.deepEqual(loot.openLoot('alice', 'wolf'), { error: 'You are too far away.' });
});

test('a taken drop leaves the corpse, so the same slot cannot be taken twice', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  const firstTake = loot.takeDrop('alice', 'wolf', 1);
  const secondTake = loot.takeDrop('alice', 'wolf', 1);

  assert.deepEqual(firstTake, { drop: { slot: 1, itemId: 'wolfPelt', quantity: 1 } });
  assert.deepEqual(secondTake, { error: 'That item is already gone.' });
  assert.deepEqual(
    loot.getCorpseLoot('wolf').map((drop) => drop.slot),
    [0, 2, 3],
  );
});

test('taking every drop and the money leaves the corpse with no loot', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  for (const { slot } of loot.getCorpseLoot('wolf')) loot.takeDrop('alice', 'wolf', slot);
  const lootableWithOnlyMoney = world.getEntity('wolf').lootableBy;
  loot.takeCopper('alice', 'wolf');

  assert.deepEqual(lootableWithOnlyMoney, ['alice']);
  assert.deepEqual(world.getEntity('wolf').lootableBy, []);
  assert.deepEqual(loot.openLoot('alice', 'wolf'), { error: 'That corpse has no loot for you.' });
});

test('a returned drop goes back on the corpse in its old slot', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);
  const dropsBeforeTaking = loot.getCorpseLoot('wolf');

  for (const { slot } of dropsBeforeTaking) {
    const { drop } = loot.takeDrop('alice', 'wolf', slot);
    loot.returnDrop('wolf', drop);
  }

  assert.deepEqual(loot.getCorpseLoot('wolf'), dropsBeforeTaking);
  assert.deepEqual(world.getEntity('wolf').lootableBy, ['alice']);
});

test('a killed wolf gives kill credit to the player who tagged it', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_SPELL_RANGE);
  const kills = [];
  const loot = createLoot(world, { random: neverDrops, onTaggedKill: (kill) => kills.push(kill) });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);
  world.changeHealth('wolf', 1 - world.getEntity('wolf').health);
  combat.startCast('bob', 'iceLance', 'wolf', ICE_LANCE_TRAVEL_MS);
  combat.tick(2 * ICE_LANCE_TRAVEL_MS);

  const { level, maxHealth } = CREATURES.wolf;
  const { x, z } = WOLF_IN_SPELL_RANGE;
  assert.deepEqual(kills, [{ taggerId: 'alice', creatureKind: 'wolf', level, maxHealth, x, z }]);
});

test('a killed training dummy gives no kill credit', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addDummy('dummy', WOLF_IN_SPELL_RANGE);
  const kills = [];
  const loot = createLoot(world, { random: alwaysDrops, onTaggedKill: (kill) => kills.push(kill) });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));

  world.changeHealth('dummy', -99);
  combat.startCast('alice', 'iceLance', 'dummy', 0);
  combat.tick(ICE_LANCE_TRAVEL_MS);

  assert.deepEqual(kills, []);
});

test('a coin drops when its roll is below its drop chance, and each coin counts at its value in copper', () => {
  const table = [
    { coin: 'copper', dropChance: 0.8, minAmount: 5, maxAmount: 30 },
    { coin: 'silver', dropChance: 0.1, minAmount: 1, maxAmount: 2 },
    { coin: 'gold', dropChance: 0.01, minAmount: 1, maxAmount: 1 },
  ];
  const rolls = [0.5, 0, 0.05, 0.999, 0.5];

  // Copper drops at 5, silver drops at 2 (200 copper), and gold does not drop.
  assert.equal(rollMoney(table, () => rolls.shift()), 205);
});

test('money taken from a corpse cannot be taken twice', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  const firstTake = loot.takeCopper('alice', 'wolf');
  const secondTake = loot.takeCopper('alice', 'wolf');

  assert.deepEqual(firstTake, { copper: LOWEST_WOLF_MONEY });
  assert.deepEqual(secondTake, { error: 'That money is already gone.' });
});

test('returned money goes back on the corpse and makes it lootable again', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);
  for (const { slot } of loot.getCorpseLoot('wolf')) loot.takeDrop('alice', 'wolf', slot);

  const { copper } = loot.takeCopper('alice', 'wolf');
  loot.returnCopper('wolf', copper);

  assert.equal(loot.getCorpseCopper('wolf'), LOWEST_WOLF_MONEY);
  assert.deepEqual(world.getEntity('wolf').lootableBy, ['alice']);
});

test('every looter that the loot gets from lootersFor can open the corpse, and no one else can', () => {
  const world = createWorldState();
  world.addPlayer('alice', 'Alice', 'dawnguard', 1);
  world.addPlayer('bob', 'Bob', 'dawnguard', 1);
  world.addPlayer('carol', 'Carol', 'dawnguard', 1);
  world.addCreature('wolf', 'wolf', WOLF_IN_LOOT_RANGE);
  const loot = createLoot(world, { random: alwaysDrops, lootersFor: (taggerId) => [taggerId, 'bob'] });
  const combat = createCombat(world, (event) => loot.handleCombatEvent(event));
  world.changeHealth('wolf', 1 - CREATURES.wolf.maxHealth);
  combat.startCast('alice', 'iceLance', 'wolf', 0);
  combat.tick(KILL_IN_LOOT_RANGE_MS);

  assert.deepEqual(world.getEntity('wolf').lootableBy, ['alice', 'bob']);
  assert.ok(loot.openLoot('bob', 'wolf').drops);
  assert.deepEqual(loot.openLoot('carol', 'wolf'), { error: 'That corpse has no loot for you.' });
});

