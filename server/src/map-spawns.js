import { NPCS } from 'questforge-shared/npcs.js';
import { BANDIT_CAMP } from 'questforge-shared/places.js';
import { BOSS_CHAMBER } from 'questforge-shared/cave-terrain.js';

// Players spawn at the origin facing +z, so the dummies stand in front of them.
const DUMMY_SPAWNS = [
  { x: -6, z: 10, rotation: Math.PI },
  { x: 0, z: 12, rotation: Math.PI },
  { x: 6, z: 10, rotation: Math.PI },
];

// Each wolf stands among the trees. The wolves are at least 32 units apart, more than two aggro ranges
// plus their wander range, so that a player can pull one wolf at a time. The wolves farther from the player spawn
// are a level higher, and the alpha wolf roams a clearing of its own, far from the others.
// The bandit camp fills the south-west corner. Its thugs stand in a ring about 16 units apart, closer than the
// wolves, so that a careless player pulls two at once. The leader stands at the campfire in the middle.
const CREATURE_SPAWNS = [
  { kind: 'wolf', x: -22, z: 24 },
  { kind: 'wolf', x: 24, z: -24 },
  { kind: 'wolf', x: -20, z: -28 },
  { kind: 'wolf', x: 24, z: 26 },
  { kind: 'wolf', x: 0, z: 48, level: 2 },
  { kind: 'wolf', x: 50, z: 4, level: 2 },
  { kind: 'wolf', x: -50, z: -10, level: 2 },
  { kind: 'wolf', x: 6, z: -56, level: 2 },
  { kind: 'wolf', x: 36, z: 66, level: 2 },
  { kind: 'alphaWolf', x: 62, z: 42 },
  { kind: 'bandit', x: -70, z: -60 },
  { kind: 'bandit', x: -59, z: -75 },
  { kind: 'bandit', x: -70, z: -90 },
  { kind: 'bandit', x: -88, z: -84 },
  { kind: 'bandit', x: -88, z: -66 },
  { kind: 'banditLeader', x: -75, z: -72 },
];
// A bandit faces the middle of the camp. Other creatures face a direction from their place in the list.
function spawnRotation({ kind, x, z }, index) {
  if (kind !== 'bandit' && kind !== 'banditLeader') return index;
  return Math.atan2(BANDIT_CAMP.x - x, BANDIT_CAMP.z - z);
}

// The spiders wait in pairs along the path of the cave, so a party fights two at a time. The Broodmother waits at the
// far side of her chamber, far enough from its entrance that the party can gather before the fight.
const CAVE_CREATURE_SPAWNS = [
  { kind: 'giantCaveSpider', x: -18, z: -12 },
  { kind: 'giantCaveSpider', x: -11, z: -20 },
  { kind: 'giantCaveSpider', x: 2, z: 0 },
  { kind: 'giantCaveSpider', x: 6, z: 4 },
  { kind: 'giantCaveSpider', x: 22, z: 16 },
  { kind: 'giantCaveSpider', x: 15, z: 21 },
  { kind: 'giantCaveSpider', x: 4, z: 32 },
  { kind: 'giantCaveSpider', x: 8, z: 36 },
  { kind: 'broodmother', x: BOSS_CHAMBER.x - 2, z: BOSS_CHAMBER.z + 6 },
];

// Adds the dummies, NPCs, and creatures of a map to its world, and returns the ids of the creatures, which the
// creature AI controls.
export function populateMap(mapId, world) {
  if (mapId === 'spiderCave') return addCreatures(world, CAVE_CREATURE_SPAWNS);

  DUMMY_SPAWNS.forEach((spawn, index) => world.addDummy(`dummy-${index + 1}`, spawn));
  Object.values(NPCS).forEach((npc) => world.addNpc(npc));
  return addCreatures(world, CREATURE_SPAWNS);
}

function addCreatures(world, spawns) {
  return spawns.map((spawn, index) => {
    const { kind, x, z, level } = spawn;
    const place = { x, z, rotation: spawnRotation(spawn, index) };
    return world.addCreature(`${kind}-${index + 1}`, kind, place, { level }).id;
  });
}
