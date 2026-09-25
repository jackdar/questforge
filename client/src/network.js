import { activeTerrain } from './active-map.js';
import { setDeadPose } from './player.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.js';
import { createCharacterAnimator } from './character-animator.js';
import { createWolfAnimator } from './wolf-animator.js';
import { createSpiderAnimator } from './spider-animator.js';
import { CREATURES } from 'questforge-shared/creatures.js';

const FOUR_LEGGED_MODELS = ['wolf', 'alphaWolf'];
const SPIDER_MODELS = ['giantSpider', 'spiderling', 'broodmother'];

const SEND_INTERVAL_MS = 50;
const REMOTE_SMOOTHING = 10;
const PING_INTERVAL_MS = 2000;
const MOVING_THRESHOLD = 0.05;
const AIRBORNE_THRESHOLD = 0.05;

export function createNetwork(scene) {
  const remoteEntities = new Map();
  const listeners = new Map();
  let localPlayerId = null;
  let localPlayer = null;
  let lastSentTime = 0;
  let lastSentPayload = '';
  let pingMs = null;
  let socket = null;

  // The server accepts the connection only with a session cookie, so connect after the player logs in.
  function connect() {
    if (socket && socket.readyState <= WebSocket.OPEN) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const currentSocket = new WebSocket(`${protocol}://${window.location.host}/ws`);
    socket = currentSocket;

    // A socket that the player left on purpose can still deliver messages and a close event. Ignore them.
    currentSocket.addEventListener('message', (event) => {
      if (socket !== currentSocket) return;
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') localPlayerId = message.id;
      if (message.type === 'snapshot') applySnapshot(message.entities);
      if (message.type === 'pong') pingMs = performance.now() - message.sentAt;
      notify(message);
    });

    currentSocket.addEventListener('close', () => {
      if (socket !== currentSocket) return;
      clearWorld();
      notify({ type: 'connectionClosed' });
    });
  }

  // The server removes the character from the world when its connection closes.
  function leaveWorld() {
    const leavingSocket = socket;
    socket = null;
    clearWorld();
    leavingSocket?.close(1000, 'The player left the world.');
  }

  function clearWorld() {
    clearMap();
    localPlayerId = null;
    pingMs = null;
  }

  // On a move to another map, the characters of the old map go away, but the player stays the same player.
  // The next snapshot of the new map brings the player state back, and the position goes out again in full.
  function clearMap() {
    for (const id of remoteEntities.keys()) removeRemoteEntity(id);
    localPlayer = null;
    lastSentPayload = '';
  }

  setInterval(() => {
    if (isOpen()) socket.send(JSON.stringify({ type: 'ping', sentAt: performance.now() }));
  }, PING_INTERVAL_MS);

  function isOpen() {
    return socket?.readyState === WebSocket.OPEN;
  }

  function on(messageType, listener) {
    listeners.set(messageType, [...(listeners.get(messageType) ?? []), listener]);
  }

  function notify(message) {
    for (const listener of listeners.get(message.type) ?? []) listener(message);
  }

  function applySnapshot(entities) {
    const entityIdsInSnapshot = new Set();

    for (const entity of entities) {
      if (entity.id === localPlayerId) {
        localPlayer = entity;
        continue;
      }
      entityIdsInSnapshot.add(entity.id);

      const remoteEntity = remoteEntities.get(entity.id) ?? addRemoteEntity(entity);
      remoteEntity.state = entity;
    }

    for (const id of remoteEntities.keys()) {
      if (!entityIdsInSnapshot.has(id)) removeRemoteEntity(id);
    }
  }

  function addRemoteEntity(entity) {
    const model = modelOf(entity);
    const { root: mesh, parts } = createCharacterModel(model);
    mesh.userData.entityId = entity.id;
    mesh.position.set(entity.x, entity.y, entity.z);
    mesh.rotation.y = entity.rotation;
    scene.add(mesh);

    const animator = createAnimator(model, parts);
    const fallsOnSide = FOUR_LEGGED_MODELS.includes(model) || SPIDER_MODELS.includes(model);
    const remoteEntity = { mesh, state: entity, animator, fallsOnSide, height: entity.y, wasAirborne: false };
    remoteEntities.set(entity.id, remoteEntity);
    return remoteEntity;
  }

  function removeRemoteEntity(id) {
    const remoteEntity = remoteEntities.get(id);
    scene.remove(remoteEntity.mesh);
    disposeCharacterModel(remoteEntity.mesh);
    remoteEntities.delete(id);
  }

  function update(deltaSeconds, now) {
    const blend = 1 - Math.exp(-REMOTE_SMOOTHING * deltaSeconds);

    for (const remoteEntity of remoteEntities.values()) {
      const { mesh, state, animator } = remoteEntity;
      const isDead = state.health === 0;
      const isMoving = Math.hypot(state.x - mesh.position.x, state.z - mesh.position.z) > MOVING_THRESHOLD;
      // Another player's jump arrives as height in the snapshots, so the animation reads the jump from that height.
      const isAirborne = state.y > activeTerrain().groundHeightAt(state.x, state.z) + AIRBORNE_THRESHOLD;
      if (remoteEntity.wasAirborne && !isAirborne) animator?.land(now);
      remoteEntity.wasAirborne = isAirborne;
      const previousX = mesh.position.x;
      const previousZ = mesh.position.z;
      mesh.position.x += (state.x - mesh.position.x) * blend;
      mesh.position.z += (state.z - mesh.position.z) * blend;
      const distanceMoved = Math.hypot(mesh.position.x - previousX, mesh.position.z - previousZ);
      const speed = deltaSeconds > 0 ? distanceMoved / deltaSeconds : 0;
      if (!isDead) animator?.update(now, deltaSeconds, { isMoving: isMoving && !isAirborne, isAirborne, speed });
      mesh.rotation.y += shortestAngleBetween(mesh.rotation.y, state.rotation) * blend;
      remoteEntity.height += (state.y - remoteEntity.height) * blend;
      setDeadPose(mesh, isDead, remoteEntity.height, { fallsOnSide: remoteEntity.fallsOnSide });
    }
  }

  function sendPosition(movementState, now) {
    if (now - lastSentTime < SEND_INTERVAL_MS) return;
    if (sendPositionIfChanged(movementState)) lastSentTime = now;
  }

  function sendPositionIfChanged({ x, y, z, rotation }) {
    if (!isOpen()) return false;

    const payload = JSON.stringify({ type: 'move', x, y, z, rotation });
    if (payload === lastSentPayload) return false;

    socket.send(payload);
    lastSentPayload = payload;
    return true;
  }

  // The server interrupts a cast when the caster moves, and it checks that the caster faces the target.
  // Send the latest position and rotation first, so that the send interval cannot hold them back until after the cast.
  function castSpell(spellId, targetId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'cast', spellId, targetId }));
  }

  function sendChat(text) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'chat', text }));
  }

  // Send the latest position first, so that the server checks the loot range from where the player stands.
  function openLoot(corpseId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'openLoot', entityId: corpseId }));
  }

  function buyItem(npcId, itemId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'buyItem', npcId, itemId }));
  }

  function sellItem(npcId, slot, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'sellItem', npcId, slot }));
  }

  function buyBackItem(npcId, saleId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'buyBackItem', npcId, saleId }));
  }

  function takeLootMoney(corpseId) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'takeLootMoney', entityId: corpseId }));
  }

  function takeLoot(corpseId, slot) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'takeLoot', entityId: corpseId, slot }));
  }

  function moveItem(fromSlot, toSlot) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'moveItem', fromSlot, toSlot }));
  }

  function acceptQuest(questId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'acceptQuest', questId }));
  }

  function turnInQuest(questId, movementState) {
    if (!isOpen()) return;
    sendPositionIfChanged(movementState);
    socket.send(JSON.stringify({ type: 'turnInQuest', questId }));
  }

  function abandonQuest(questId) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'abandonQuest', questId }));
  }

  function invitePlayer(targetId) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'invitePlayer', targetId }));
  }

  function respondToPartyInvite(accepts) {
    if (isOpen()) socket.send(JSON.stringify({ type: 'respondToPartyInvite', accepts }));
  }

  function leaveParty() {
    if (isOpen()) socket.send(JSON.stringify({ type: 'leaveParty' }));
  }

  function stopAutoAttack() {
    if (isOpen()) socket.send(JSON.stringify({ type: 'stopAttack' }));
  }

  function join(characterId) {
    const sendJoin = () => socket.send(JSON.stringify({ type: 'join', characterId }));
    if (isOpen()) sendJoin();
    else socket?.addEventListener('open', sendJoin, { once: true });
  }

  return {
    connect,
    leaveWorld,
    clearMap,
    on,
    update,
    sendPosition,
    castSpell,
    openLoot,
    takeLoot,
    takeLootMoney,
    buyItem,
    sellItem,
    buyBackItem,
    moveItem,
    invitePlayer,
    respondToPartyInvite,
    leaveParty,
    acceptQuest,
    turnInQuest,
    abandonQuest,
    stopAutoAttack,
    sendChat,
    join,
    getPingMs: () => pingMs,
    getLocalPlayerId: () => localPlayerId,
    getLocalPlayer: () => localPlayer,
    getRemoteEntity: (id) => remoteEntities.get(id),
    getRemoteEntities: () => [...remoteEntities.values()],
  };
}

// A player shows the model of its faction, an NPC its appearance, and a creature the model of its kind.
function modelOf(entity) {
  if (entity.kind === 'player') return entity.faction;
  return entity.appearance ?? CREATURES[entity.kind]?.model ?? entity.kind;
}

// Every model with arms and legs, such as a bandit or an NPC, uses the character animator.
function createAnimator(model, parts) {
  if (FOUR_LEGGED_MODELS.includes(model)) return createWolfAnimator(parts);
  if (SPIDER_MODELS.includes(model)) return createSpiderAnimator(parts);
  if (model === 'dummy') return null;
  return createCharacterAnimator(parts);
}

function shortestAngleBetween(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
