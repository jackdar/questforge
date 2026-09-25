import { CREATURES } from 'questforge-shared/creatures.js';
import { LOOT_RANGE, LOOT_TABLES, MONEY_TABLES } from 'questforge-shared/loot-tables.js';
import { COIN_VALUES } from 'questforge-shared/money.js';

export function rollLoot(lootTable, random) {
  const drops = [];
  for (const { itemId, dropChance, minQuantity, maxQuantity } of lootTable) {
    if (random() >= dropChance) continue;
    const quantity = minQuantity + Math.floor(random() * (maxQuantity - minQuantity + 1));
    drops.push({ itemId, quantity });
  }
  return drops;
}

// Returns the total money in copper.
export function rollMoney(moneyTable, random) {
  let copper = 0;
  for (const { coin, dropChance, minAmount, maxAmount } of moneyTable) {
    if (random() >= dropChance) continue;
    const amount = minAmount + Math.floor(random() * (maxAmount - minAmount + 1));
    copper += amount * COIN_VALUES[coin];
  }
  return copper;
}

// As in WoW, the first player to damage a creature tags it. lootersFor names the players who can loot the corpse,
// which are the tagger and the party members near the kill, and onTaggedKill hands out the xp and quest credit.
// A creature that evades or respawns loses its tag.
export function createLoot(
  world,
  { random = Math.random, onTaggedKill = () => {}, lootersFor = (taggerId) => [taggerId] } = {},
) {
  const tags = new Map();
  // The looters of each corpse stay known until it respawns, so a drop can go back to them when a save fails.
  const lootersByCorpseId = new Map();
  // Each corpse with loot holds { drops, copper }.
  const corpseLoot = new Map();

  function handleCombatEvent(event) {
    if (event.type === 'spellHit' && event.effect === 'damage') handleDamage(event);
    if (event.type === 'respawn') forgetCreature(event.entityId);
  }

  function handleDamage({ casterId, targetId }) {
    const target = world.getEntity(targetId);
    if (!CREATURES[target?.kind]) return;
    if (!tags.has(targetId) && world.getEntity(casterId)?.kind === 'player') tags.set(targetId, casterId);
    if (target.health > 0) return;

    const taggerId = tags.get(targetId);
    if (taggerId) {
      const { kind: creatureKind, level, maxHealth, x, z } = target;
      onTaggedKill({ taggerId, creatureKind, level, maxHealth, x, z });
    }
    dropLoot(targetId, CREATURES[target.kind].lootTableId);
  }

  function dropLoot(creatureId, lootTableId) {
    const taggerId = tags.get(creatureId);
    if (!taggerId) return;
    const drops = rollLoot(LOOT_TABLES[lootTableId], random);
    const copper = rollMoney(MONEY_TABLES[lootTableId], random);
    if (drops.length === 0 && copper === 0) return;
    // A slot number names each drop, so that taking one drop does not change the names of the others.
    corpseLoot.set(creatureId, { drops: drops.map((drop, slot) => ({ slot, ...drop })), copper });
    const looters = lootersFor(taggerId, world.getEntity(creatureId));
    lootersByCorpseId.set(creatureId, looters);
    world.setLootableBy(creatureId, looters);
  }

  function forgetCreature(creatureId) {
    tags.delete(creatureId);
    corpseLoot.delete(creatureId);
    lootersByCorpseId.delete(creatureId);
    world.setLootableBy(creatureId, []);
  }

  function tick() {
    for (const creatureId of tags.keys()) {
      if (world.getEntity(creatureId)?.isEvading) tags.delete(creatureId);
    }
  }

  function getCorpseLoot(creatureId) {
    return corpseLoot.get(creatureId)?.drops.map((drop) => ({ ...drop })) ?? [];
  }

  function getCorpseCopper(creatureId) {
    return corpseLoot.get(creatureId)?.copper ?? 0;
  }

  function findLootProblem(playerId, corpseId) {
    const player = world.getEntity(playerId);
    const corpse = world.getEntity(corpseId);
    if (!player || !corpse || corpse.health > 0 || !corpse.lootableBy.includes(playerId)) {
      return 'That corpse has no loot for you.';
    }
    if (Math.hypot(corpse.x - player.x, corpse.z - player.z) > LOOT_RANGE) return 'You are too far away.';
    return null;
  }

  function openLoot(playerId, corpseId) {
    const problem = findLootProblem(playerId, corpseId);
    return problem ? { error: problem } : { drops: getCorpseLoot(corpseId), copper: getCorpseCopper(corpseId) };
  }

  // The drop leaves the corpse at once, so that a second request for the same slot finds nothing.
  // The caller saves the drop to the inventory, and gives it back with returnDrop when the save fails.
  function takeDrop(playerId, corpseId, slot) {
    const problem = findLootProblem(playerId, corpseId);
    if (problem) return { error: problem };

    const { drops } = corpseLoot.get(corpseId);
    const drop = drops.find((candidate) => candidate.slot === slot);
    if (!drop) return { error: 'That item is already gone.' };

    drops.splice(drops.indexOf(drop), 1);
    forgetEmptyCorpse(corpseId);
    return { drop: { ...drop } };
  }

  // The money leaves the corpse at once, like a drop. The caller gives it back with returnCopper when the save fails.
  function takeCopper(playerId, corpseId) {
    const problem = findLootProblem(playerId, corpseId);
    if (problem) return { error: problem };

    const loot = corpseLoot.get(corpseId);
    if (loot.copper === 0) return { error: 'That money is already gone.' };
    const { copper } = loot;
    loot.copper = 0;
    forgetEmptyCorpse(corpseId);
    return { copper };
  }

  function forgetEmptyCorpse(corpseId) {
    const { drops, copper } = corpseLoot.get(corpseId);
    if (drops.length > 0 || copper > 0) return;
    corpseLoot.delete(corpseId);
    world.setLootableBy(corpseId, []);
  }

  function returnDrop(corpseId, drop) {
    const loot = lootToReturnTo(corpseId);
    if (!loot) return;
    loot.drops.push(drop);
    loot.drops.sort((a, b) => a.slot - b.slot);
  }

  function returnCopper(corpseId, copper) {
    const loot = lootToReturnTo(corpseId);
    if (loot) loot.copper += copper;
  }

  // A corpse that respawned while the save ran has no loot to return to.
  function lootToReturnTo(corpseId) {
    const corpse = world.getEntity(corpseId);
    if (!corpse || corpse.health > 0) return null;
    if (!corpseLoot.has(corpseId)) corpseLoot.set(corpseId, { drops: [], copper: 0 });
    world.setLootableBy(corpseId, lootersByCorpseId.get(corpseId) ?? []);
    return corpseLoot.get(corpseId);
  }

  return {
    handleCombatEvent,
    tick,
    getCorpseLoot,
    getCorpseCopper,
    openLoot,
    takeDrop,
    takeCopper,
    returnDrop,
    returnCopper,
  };
}
