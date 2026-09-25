import * as THREE from 'three';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createThirdPersonCamera } from './camera.js';
import { createNetwork } from './network.js';
import { createTargeting } from './targeting.js';
import { createHud } from './hud.js';
import { createActionBar } from './action-bar.js';
import { createSpellEffects } from './spell-effects.js';
import { createStatsDisplay } from './stats.js';
import { createLoginScreen } from './login-screen.js';
import { createCharacterSelectScreen } from './character-select.js';
import { createCharacterCreateScreen } from './character-create.js';
import { createNameplates } from './nameplates.js';
import { createGameMenu } from './game-menu.js';
import { createChat } from './chat.js';
import { isTypingInFormField } from './keyboard.js';
import { renderKeybindList } from './keybinds.js';
import { fetchSession, logout } from './api-requests.js';
import { SCHOOL_COLORS } from './school-colors.js';
import { SPELLS } from 'questforge-shared/spells.js';
import { getRelationship } from 'questforge-shared/factions.js';

const MAX_FRAME_SECONDS = 0.1;
const SWING_STYLES = {
  autoAttack: 'light',
  strike: 'heavy',
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

createWorld(scene);
const player = createPlayer(scene);
const cameraRig = createThirdPersonCamera(camera, renderer.domElement);
const network = createNetwork(scene);
const targeting = createTargeting({
  scene,
  camera,
  domElement: renderer.domElement,
  network,
  playerMesh: player.mesh,
  onTargetChange: () => network.stopAutoAttack(),
});
const hud = createHud();
const stats = createStatsDisplay();
const nameplates = createNameplates(camera);
const loginScreen = createLoginScreen(showCharacters);
const characterSelect = createCharacterSelectScreen({
  onEnterWorld: enterWorld,
  onCreateCharacter: () => characterCreate.show(),
  onLogout: logOut,
});
const gameMenu = createGameMenu({ onLogOut: leaveWorld });
const chat = createChat((text) => network.sendChat(text));
const characterCreate = createCharacterCreateScreen({
  onCreated: (character) => characterSelect.show({ selectCharacterId: character.id }),
  onBack: () => characterSelect.show(),
});
const spellEffects = createSpellEffects({ scene, camera, getEntityPosition });
const actionBar = createActionBar((spellId) => {
  network.castSpell(spellId, targeting.getTarget()?.state.id ?? null, player.getMovementState());
});

function getEntityPosition(entityId) {
  if (entityId === network.getLocalPlayerId()) return player.mesh.position;
  return network.getRemoteEntity(entityId)?.mesh.position;
}

function getAnimator(entityId) {
  if (entityId === network.getLocalPlayerId()) return player.getAnimator();
  return network.getRemoteEntity(entityId)?.animator;
}

function isLocalPlayer(entityId) {
  return entityId === network.getLocalPlayerId();
}

document.getElementById('player-frame').addEventListener('click', () => targeting.targetSelf());

function showCharacters(account) {
  characterSelect.setAccount(account);
  characterSelect.show();
}

function enterWorld(character) {
  network.connect();
  network.join(character.id);
}

function leaveWorld() {
  network.leaveWorld();
  chat.hide();
  setHelpAvailable(false);
  targeting.clearTarget();
  actionBar.setAutoAttacking(false);
  hud.stopCast();
  characterSelect.show();
}

for (const list of document.querySelectorAll('.keybind-list')) renderKeybindList(list);

const helpPanel = document.getElementById('controls');
const helpPrompt = helpPanel.querySelector('.help-prompt');
const helpList = helpPanel.querySelector('.keybind-list');

// The help shows only while a character is in the world, and starts closed each time.
function setHelpAvailable(isAvailable) {
  helpPanel.hidden = !isAvailable;
  helpList.hidden = true;
  helpPrompt.hidden = false;
}

window.addEventListener('keydown', (event) => {
  if (isTypingInFormField(event) || event.repeat) return;

  // Esc first closes the game menu, then clears the target, and only then opens the game menu.
  if (event.code === 'Escape') {
    if (gameMenu.isOpen()) gameMenu.close();
    else if (targeting.getTarget()) targeting.clearTarget();
    else if (network.getLocalPlayer()) gameMenu.open();
  }

  if ((event.code === 'Enter' || event.code === 'NumpadEnter') && network.getLocalPlayer() && !gameMenu.isOpen()) {
    event.preventDefault();
    chat.openInput();
  }

  if (event.code === 'KeyH' && network.getLocalPlayer()) {
    helpList.hidden = !helpList.hidden;
    helpPrompt.hidden = !helpList.hidden;
  }
});

async function logOut() {
  const result = await logout();
  if (!result.ok) {
    hud.showError(result.error, performance.now());
    return;
  }
  window.location.reload();
}

fetchSession().then((result) => {
  if (result.ok) showCharacters(result.account);
  else loginScreen.show();
});

network.on('connectionClosed', () => {
  hud.showError('The connection to the server closed. Reload the page to reconnect.', performance.now());
});

network.on('chat', (message) => chat.addMessage(message));
network.on('chatFailed', ({ message }) => chat.addSystemMessage(message));

network.on('welcome', ({ id, faction, x, y, z, rotation }) => {
  chat.show();
  setHelpAvailable(true);
  player.mesh.userData.entityId = id;
  player.setPosition({ x, y, z, rotation });
  player.setAppearance(faction);
});

network.on('joinFailed', ({ message }) => characterSelect.show({ error: message }));

network.on('castStart', ({ casterId, spellId, durationMs }) => {
  const spell = SPELLS[spellId];
  getAnimator(casterId)?.startCast(SCHOOL_COLORS[spell.school]);
  if (isLocalPlayer(casterId)) hud.startCast(spell, durationMs, performance.now());
});

network.on('castStop', ({ casterId, reason, message }) => {
  getAnimator(casterId)?.stopCast({ completed: reason === 'completed' }, performance.now());
  if (!isLocalPlayer(casterId)) return;
  hud.stopCast();
  if (reason === 'failed') hud.showError(message, performance.now());
});

network.on('castFailed', ({ message }) => hud.showError(message, performance.now()));

network.on('spellHit', (spellHit) => {
  const now = performance.now();
  const swingStyle = SWING_STYLES[spellHit.spellId];
  if (swingStyle) getAnimator(spellHit.casterId)?.swing(swingStyle, now);
  else if (SPELLS[spellHit.spellId].castTimeMs === 0) getAnimator(spellHit.casterId)?.release(now);

  spellEffects.showSpellHit(spellHit, now);
  if (isLocalPlayer(spellHit.casterId)) actionBar.startCooldown(spellHit.spellId, performance.now());
});

network.on('autoAttackStart', ({ casterId }) => {
  if (isLocalPlayer(casterId)) actionBar.setAutoAttacking(true);
});

network.on('autoAttackStop', ({ casterId }) => {
  if (isLocalPlayer(casterId)) actionBar.setAutoAttacking(false);
});

network.on('respawn', ({ entityId, x, y, z }) => {
  if (isLocalPlayer(entityId)) player.setPosition({ x, y, z });
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let previousTime = performance.now();

renderer.setAnimationLoop((time) => {
  const deltaSeconds = Math.min((time - previousTime) / 1000, MAX_FRAME_SECONDS);
  previousTime = time;

  const localPlayer = network.getLocalPlayer();

  player.mesh.visible = Boolean(localPlayer);
  if (localPlayer) {
    player.update(deltaSeconds, cameraRig.getYaw(), {
      isDead: localPlayer.health === 0,
      isTurningWithCamera: cameraRig.isTurningCharacter(),
      now: time,
    });
    network.sendPosition(player.getMovementState(), time);
  }
  network.update(deltaSeconds, time);
  cameraRig.update(player.mesh.position);
  targeting.update();
  spellEffects.update(deltaSeconds, time);

  const target = targeting.getTarget()?.state;
  actionBar.update(time, localPlayer, target);
  hud.update({
    player: localPlayer,
    target,
    targetRelationship: localPlayer && target ? getRelationship(localPlayer, target) : null,
    now: time,
  });
  stats.update(time, network.getPingMs());
  nameplates.update(
    [
      ...network.getRemoteEntities().map(({ state, mesh }) => ({ state, position: mesh.position })),
      ...(localPlayer ? [{ state: localPlayer, position: player.mesh.position }] : []),
    ],
    localPlayer,
  );

  renderer.render(scene, camera);
});
