import { groundHeightAt } from 'questforge-shared/terrain.js';
import { setDeadPose } from './player.js';
import { createCharacterModel, disposeCharacterModel } from './character-model.js';
import { createCharacterAnimator } from './character-animator.js';

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
    for (const id of remoteEntities.keys()) removeRemoteEntity(id);
    localPlayerId = null;
    localPlayer = null;
    lastSentPayload = '';
    pingMs = null;
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
    const isDummy = entity.kind === 'dummy';
    const { root: mesh, parts } = createCharacterModel(isDummy ? 'dummy' : entity.faction);
    mesh.userData.entityId = entity.id;
    mesh.position.set(entity.x, entity.y, entity.z);
    mesh.rotation.y = entity.rotation;
    scene.add(mesh);

    const animator = isDummy ? null : createCharacterAnimator(parts);
    const remoteEntity = { mesh, state: entity, animator, height: entity.y, wasAirborne: false };
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
      const isAirborne = state.y > groundHeightAt(state.x, state.z) + AIRBORNE_THRESHOLD;
      if (remoteEntity.wasAirborne && !isAirborne) animator?.land(now);
      remoteEntity.wasAirborne = isAirborne;
      if (!isDead) animator?.update(now, deltaSeconds, { isMoving: isMoving && !isAirborne, isAirborne });

      mesh.position.x += (state.x - mesh.position.x) * blend;
      mesh.position.z += (state.z - mesh.position.z) * blend;
      mesh.rotation.y += shortestAngleBetween(mesh.rotation.y, state.rotation) * blend;
      remoteEntity.height += (state.y - remoteEntity.height) * blend;
      setDeadPose(mesh, isDead, remoteEntity.height);
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
    on,
    update,
    sendPosition,
    castSpell,
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

function shortestAngleBetween(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}
