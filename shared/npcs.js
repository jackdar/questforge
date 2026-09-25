// A player must stand this close to an NPC to talk to it. The server checks it before it accepts a quest action.
export const INTERACT_RANGE = 5;

// The appearance names a character model in client/src/character-model.js. An NPC with a shopId runs that shop.
export const NPCS = {
  marshalRedpine: {
    id: 'marshalRedpine',
    name: 'Marshal Redpine',
    appearance: 'marshal',
    level: 10,
    x: -5,
    z: 3,
    rotation: Math.PI / 2,
  },
  rangerAshby: {
    id: 'rangerAshby',
    name: 'Ranger Ashby',
    appearance: 'ranger',
    level: 8,
    x: -46,
    z: 32,
    rotation: Math.PI,
  },
  traderMossbeard: {
    id: 'traderMossbeard',
    name: 'Trader Mossbeard',
    appearance: 'dwarf',
    level: 10,
    x: 5,
    z: 3,
    rotation: -Math.PI / 2,
    shopId: 'mossbeardGoods',
  },
};
