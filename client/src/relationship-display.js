import { getRelationship } from 'questforge-shared/factions.js';
import { CREATURES } from 'questforge-shared/creatures.js';

// How a unit shows to the viewer. A neutral creature is hostile, so the player can attack it, but it shows yellow,
// as in WoW, because it does not attack first.
export function displayRelationship(viewer, entity) {
  const relationship = getRelationship(viewer, entity);
  return relationship === 'hostile' && CREATURES[entity.kind]?.isNeutral ? 'neutral' : relationship;
}
