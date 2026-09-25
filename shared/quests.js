// How to write a quest:
// - giver is the NPC that offers the quest, and turnIn is the NPC that takes it back.
//   A quest with a different turnIn NPC and no objectives is a talk quest. It stays in progress until the player
//   speaks to the turnIn NPC and completes it there.
// - An objective is { type: 'kill', creatureKind, count } or { type: 'collect', itemId, count }.
//   Collected items count from the bags, and the turn-in takes them.
// - requires lists the quests that the character must complete first. This makes a chain.
export const QUESTS = {
  wolvesAtTheDoor: {
    id: 'wolvesAtTheDoor',
    name: 'Wolves at the Door',
    recommendedLevel: 1,
    giver: 'marshalRedpine',
    turnIn: 'marshalRedpine',
    text: {
      offer:
        'Grey wolves prowl the trees around our camp, and they grow bolder each night. ' +
        'Thin their numbers before they find the courage to come closer.',
      progress: 'The wolves still circle the camp. Keep at it.',
      completion: 'Good work. The night watch will sleep easier.',
    },
    objectives: [{ type: 'kill', creatureKind: 'wolf', count: 5 }],
    rewards: { xp: 150, items: [] },
    requires: [],
  },
  peltsForTheTanner: {
    id: 'peltsForTheTanner',
    name: 'Pelts for the Tanner',
    recommendedLevel: 2,
    giver: 'marshalRedpine',
    turnIn: 'marshalRedpine',
    text: {
      offer: 'Winter comes early here. Bring me wolf pelts, and our tanner will make boots for the watch.',
      progress: 'Do you have the pelts?',
      completion: 'Fine pelts. Take these boots, the tanner made a spare pair.',
    },
    objectives: [{ type: 'collect', itemId: 'wolfPelt', count: 3 }],
    rewards: { xp: 150, items: [{ itemId: 'wornLeatherBoots', quantity: 1 }] },
    requires: ['wolvesAtTheDoor'],
  },
  wordToTheRanger: {
    id: 'wordToTheRanger',
    name: 'Word to the Ranger',
    recommendedLevel: 2,
    giver: 'marshalRedpine',
    turnIn: 'rangerAshby',
    text: {
      offer:
        'Ranger Ashby keeps watch in the woods to the north-west. Tell her the camp is safe for now. ' +
        'She will know what to do next.',
      progress: 'You have news from the marshal?',
      completion: 'The camp holds? Good. Then I have work for you.',
    },
    objectives: [],
    rewards: { xp: 50, items: [] },
    requires: ['peltsForTheTanner'],
  },
  thinTheHerd: {
    id: 'thinTheHerd',
    name: 'Thin the Herd',
    recommendedLevel: 3,
    giver: 'rangerAshby',
    turnIn: 'rangerAshby',
    text: {
      offer: 'Hunt the wolves before they breed again. The woods will be quiet for a season.',
      progress: 'The woods are still loud with howling.',
      completion: 'Quiet at last. You hunt well.',
    },
    objectives: [{ type: 'kill', creatureKind: 'wolf', count: 8 }],
    rewards: { xp: 200, items: [] },
    requires: ['wordToTheRanger'],
  },
  theAlpha: {
    id: 'theAlpha',
    name: 'The Alpha',
    recommendedLevel: 4,
    giver: 'rangerAshby',
    turnIn: 'rangerAshby',
    text: {
      offer:
        'The pack answers to an alpha, a great dark wolf that roams a clearing to the north-east. ' +
        'It is bigger than the others, and it will smell you from much farther away. ' +
        'Kill it, and the pack will scatter.',
      progress: 'The alpha still hunts. Be careful, it hits hard.',
      completion: 'The alpha is dead? Then the woods are ours again. The marshal will want to hear this.',
    },
    objectives: [{ type: 'kill', creatureKind: 'alphaWolf', count: 1 }],
    rewards: { xp: 250, items: [] },
    requires: ['thinTheHerd'],
  },
  banditTrouble: {
    id: 'banditTrouble',
    name: 'Bandit Trouble',
    recommendedLevel: 5,
    giver: 'marshalRedpine',
    turnIn: 'marshalRedpine',
    text: {
      offer:
        'With the wolves gone, the bandits in the south-west corner grow bold. Their camp is well guarded, ' +
        'and their leader is no common thug. Do not go alone before you are ready. ' +
        'Break the camp, and bring down the leader.',
      progress: 'The bandits still hold their camp.',
      completion:
        'The camp is broken and the leader is dead. You have earned a place in the militia. Wear this with pride.',
    },
    objectives: [
      { type: 'kill', creatureKind: 'bandit', count: 5 },
      { type: 'kill', creatureKind: 'banditLeader', count: 1 },
    ],
    rewards: { xp: 600, items: [{ itemId: 'redpineMilitiaCloak', quantity: 1 }] },
    requires: ['theAlpha'],
  },
  intoTheWeb: {
    id: 'intoTheWeb',
    name: 'Into the Web',
    recommendedLevel: 7,
    giver: 'marshalRedpine',
    turnIn: 'marshalRedpine',
    text: {
      offer:
        'The bandits were only a symptom. Beyond the river, a cave in the north-east mountains swarms with giant ' +
        'spiders, and their Broodmother breeds more each night. Do not go alone: take a companion you trust, and ' +
        'make sure one of you can heal. Kill the Broodmother, and this valley will finally rest.',
      progress: 'The spiders still spill from that cave. Is the Broodmother dead?',
      completion:
        'You faced the Broodmother and lived. Redpine Vale owes you more than I can pay. Take this fang as proof, ' +
        'and my thanks.',
    },
    objectives: [{ type: 'kill', creatureKind: 'broodmother', count: 1 }],
    rewards: { xp: 1500, items: [{ itemId: 'fangOfTheBroodmother', quantity: 1 }] },
    requires: ['banditTrouble'],
  },
};
