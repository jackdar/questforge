export const FACTIONS = {
  dawnguard: { id: 'dawnguard', name: 'Dawnguard' },
  emberclaw: { id: 'emberclaw', name: 'Emberclaw' },
};

// An entity without a faction, such as a creature, is hostile to everything, including other entities without a faction.
// An NPC, such as a quest giver, is friendly to everyone, so that no one can attack it.
export function getRelationship(source, target) {
  if (source.id === target.id) return 'self';
  if (source.kind === 'npc' || target.kind === 'npc') return 'friendly';
  if (source.faction && source.faction === target.faction) return 'friendly';
  return 'hostile';
}
