import * as THREE from 'three';
import { createMapScenery } from './map-scenery.js';
import { activeMapId, setActiveMap } from './active-map.js';
import { MAPS } from 'questforge-shared/maps.js';
import { createPlayer } from './player.js';
import { createThirdPersonCamera } from './camera.js';
import { createNetwork } from './network.js';
import { createTargeting } from './targeting.js';
import { createHud } from './hud.js';
import { createActionBar } from './action-bar.js';
import { createSpellEffects } from './spell-effects.js';
import { createLootSparkles } from './loot-sparkles.js';
import { createLootWindow } from './loot-window.js';
import { createBagWindow } from './bag-window.js';
import { createQuestDialog } from './quest-dialog.js';
import { createShopWindow } from './shop-window.js';
import { createQuestMarkers } from './quest-markers.js';
import { createQuestTracker } from './quest-tracker.js';
import { describeProgressChanges } from './quest-text.js';
import { createXpBar } from './xp-bar.js';
import { displayRelationship } from './relationship-display.js';
import { createPartyFrames, createPartyInvitePrompt, createUnitMenu } from './party-frames.js';
import { createStatsDisplay } from './stats.js';
import { createLoginScreen } from './login-screen.js';
import { createCharacterSelectScreen } from './character-select.js';
import { createCharacterCreateScreen } from './character-create.js';
import { createNameplates } from './nameplates.js';
import { createGameMenu } from './game-menu.js';
import { createChat } from './chat.js';
import { createAudio } from './audio.js';
import { createInterfaceSettings } from './interface-settings.js';
import { isTypingInFormField } from './keyboard.js';
import { renderKeybindList } from './keybinds.js';
import { fetchSession, logout } from './api-requests.js';
import { SCHOOL_COLORS } from './school-colors.js';
import { SPELLS } from 'questforge-shared/spells.js';
import { QUESTS } from 'questforge-shared/quests.js';
import { ITEMS } from 'questforge-shared/items.js';
import { LOOT_RANGE } from 'questforge-shared/loot-tables.js';
import { INTERACT_RANGE, NPCS } from 'questforge-shared/npcs.js';
import { getNpcMarker } from 'questforge-shared/quest-rules.js';
import { getRelationship } from 'questforge-shared/factions.js';
import { formatClock, timeOfDay } from 'questforge-shared/world-time.js';

const MAX_FRAME_SECONDS = 0.1;
// The difference between the server clock and this computer clock. The time of day comes from the server clock.
// The welcome message sets it. The network delay of that message is a few milliseconds, which a day of 24 minutes
// does not show.
let serverClockOffsetMs = 0;
const SWING_STYLES = {
  autoAttack: 'light',
  strike: 'heavy',
  slash: 'light',
  heavySlash: 'heavy',
};
const BITE_SPELL_IDS = ['bite', 'alphaBite', 'venomBite', 'spiderlingBite', 'crushingBite', 'poisonBite'];

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);

let scenery = createMapScenery('overworld', scene);
// The loading screen stays up this long, so the player sees where they go and the new map has time to settle.
const MAP_LOADING_SCREEN_MS = 700;
const loadingScreen = document.getElementById('loading-screen');
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
  onInteract: interactWith,
});
const hud = createHud();
const audio = createAudio(window.localStorage);
const interfaceSettings = createInterfaceSettings(window.localStorage);
const stats = createStatsDisplay();
const nameplates = createNameplates(camera, interfaceSettings);
const lootSparkles = createLootSparkles(scene);
const lootWindow = createLootWindow({
  onTake: (corpseId, slot) => network.takeLoot(corpseId, slot),
  onTakeMoney: (corpseId) => network.takeLootMoney(corpseId),
  storage: window.localStorage,
});
let requestedLootCorpseId = null;
const bagWindow = createBagWindow({
  storage: window.localStorage,
  onMove: (fromSlot, toSlot) => network.moveItem(fromSlot, toSlot),
  onStackClick: sellStackWhileShopIsOpen,
});
// The server sends the quest log and the bags. The markers, the tracker, and the quest dialog read both.
let questLog = {};
let bagStacks = [];
let experience = null;
const xpBar = createXpBar();
// The server drops an invitation after this long, so the prompt closes at the same time.
const PARTY_INVITE_TIMEOUT_MS = 60000;
const partyFrames = createPartyFrames({ onLeave: () => network.leaveParty() });
const partyInvitePrompt = createPartyInvitePrompt({
  onRespond: (accepts) => network.respondToPartyInvite(accepts),
  timeoutMs: PARTY_INVITE_TIMEOUT_MS,
});
const unitMenu = createUnitMenu({ onInvite: (targetId) => network.invitePlayer(targetId) });
const questMarkers = createQuestMarkers(camera);
const shopWindow = createShopWindow({
  storage: window.localStorage,
  onBuy: (npcId, itemId) => network.buyItem(npcId, itemId, player.getMovementState()),
  onBuyBack: (npcId, saleId) => network.buyBackItem(npcId, saleId, player.getMovementState()),
});
const questTracker = createQuestTracker({ onAbandon: (questId) => network.abandonQuest(questId) });
const questDialog = createQuestDialog({
  storage: window.localStorage,
  onAccept: (questId) => network.acceptQuest(questId, player.getMovementState()),
  onTurnIn: (questId) => network.turnInQuest(questId, player.getMovementState()),
});
const loginScreen = createLoginScreen(showCharacters);
const characterSelect = createCharacterSelectScreen({
  onEnterWorld: enterWorld,
  onCreateCharacter: () => characterCreate.show(),
  onLogout: logOut,
});
const gameMenu = createGameMenu({ onLogOut: leaveWorld, audio, interfaceSettings });
const chat = createChat((text) => network.sendChat(text));
const characterCreate = createCharacterCreateScreen({
  onCreated: (character) => characterSelect.show({ selectCharacterId: character.id }),
  onBack: () => characterSelect.show(),
});
const spellEffects = createSpellEffects({ scene, camera, getEntityPosition, onImpact: playImpactSound });
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

// A right click on an NPC opens its quests. A right click on a corpse asks the server for its loot.
// The server checks the loot tag and range, and it checks the range again when the player accepts a quest.
function interactWith(entityId) {
  const entity = network.getRemoteEntity(entityId)?.state;
  if (!entity) return;
  if (entity.kind === 'player') {
    if (getRelationship(network.getLocalPlayer(), entity) === 'friendly') unitMenu.open(entity);
    return;
  }
  if (entity.kind === 'npc') {
    if (distanceToPlayer(entity) > INTERACT_RANGE) hud.showError('You are too far away.', performance.now());
    else if (NPCS[entityId].shopId) openShop(entityId);
    else questDialog.openForNpc(entityId, questLog, bagStacks);
    return;
  }
  if (entity.health > 0) return;
  requestedLootCorpseId = entityId;
  network.openLoot(entityId, player.getMovementState());
}

// Without an open shop, a click on a stack does nothing yet.
function sellStackWhileShopIsOpen(slot) {
  if (shopWindow.isOpen()) network.sellItem(shopWindow.getNpcId(), slot, player.getMovementState());
}

// As in WoW, the bags open with the shop, so that the player can see what to sell.
function openShop(npcId) {
  shopWindow.open(npcId);
  bagWindow.open();
}

function closeShopWhenOutOfReach() {
  const npc = network.getRemoteEntity(shopWindow.getNpcId());
  if (!npc || distanceToPlayer(npc.state) > INTERACT_RANGE) shopWindow.close();
}

function distanceToPlayer({ x, z }) {
  return Math.hypot(x - player.mesh.position.x, z - player.mesh.position.z);
}

// A quest marker comes first. An NPC that runs a shop and has no quest marker shows a coin.
function npcMarker(npcId) {
  return getNpcMarker(npcId, questLog, bagStacks) ?? (NPCS[npcId].shopId ? 'shop' : null);
}

function refreshQuestViews() {
  questTracker.render(questLog, bagStacks);
  questDialog.refresh(questLog, bagStacks);
}

function showQuestProgress(after) {
  hud.showQuestMessages(describeProgressChanges({ questLog, stacks: bagStacks }, after), performance.now());
}

function closeQuestDialogWhenOutOfReach() {
  const npc = network.getRemoteEntity(questDialog.getNpcId());
  if (!npc || distanceToPlayer(npc.state) > INTERACT_RANGE) questDialog.close();
}

function closeLootWindowWhenOutOfReach() {
  const corpse = network.getRemoteEntity(lootWindow.getCorpseId());
  if (!corpse) {
    lootWindow.close();
    return;
  }
  const distance = Math.hypot(corpse.state.x - player.mesh.position.x, corpse.state.z - player.mesh.position.z);
  if (!corpse.state.lootableBy.includes(network.getLocalPlayerId()) || distance > LOOT_RANGE) lootWindow.close();
}

// Only fights that involve the local player make sound, so other fights nearby do not flood the mix.
function playImpactSound({ casterId, targetId, effect }) {
  if (effect === 'damage' && (isLocalPlayer(casterId) || isLocalPlayer(targetId))) audio.playHit();
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

// A portal moves the player to another map. The old map, its characters, and every open window go away, and the new
// map loads behind a short loading screen.
function switchMap(mapId) {
  loadingScreen.querySelector('.loading-map-name').textContent = MAPS[mapId].name;
  loadingScreen.hidden = false;
  network.clearMap();
  targeting.clearTarget();
  actionBar.setAutoAttacking(false);
  hud.stopCast();
  audio.stopCastSound();
  lootWindow.close();
  shopWindow.close();
  questDialog.close();
  unitMenu.close();

  scenery.dispose();
  setActiveMap(mapId);
  scenery = createMapScenery(mapId, scene);
  audio.startMusic(MAPS[mapId].songId);
  setTimeout(() => {
    loadingScreen.hidden = true;
  }, MAP_LOADING_SCREEN_MS);
}

function leaveWorld() {
  network.leaveWorld();
  if (activeMapId() !== 'overworld') switchMap('overworld');
  audio.stopMusic();
  chat.hide();
  setHelpAvailable(false);
  targeting.clearTarget();
  actionBar.setAutoAttacking(false);
  hud.stopCast();
  audio.stopCastSound();
  lootWindow.close();
  bagWindow.clear();
  questDialog.close();
  shopWindow.close();
  shopWindow.setBuyback([]);
  unitMenu.close();
  partyInvitePrompt.close();
  partyFrames.setParty(null);
  questTracker.clear();
  questLog = {};
  bagStacks = [];
  experience = null;
  xpBar.hide();
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

  // Esc first closes an open window, then clears the target, and only then opens the game menu.
  if (event.code === 'Escape') {
    if (lootWindow.isOpen()) lootWindow.close();
    else if (unitMenu.isOpen()) unitMenu.close();
    else if (shopWindow.isOpen()) shopWindow.close();
    else if (questDialog.isOpen()) questDialog.close();
    else if (bagWindow.isOpen()) bagWindow.close();
    else if (gameMenu.isOpen()) gameMenu.close();
    else if (targeting.getTarget()) targeting.clearTarget();
    else if (network.getLocalPlayer()) gameMenu.open();
  }

  if ((event.code === 'Enter' || event.code === 'NumpadEnter') && network.getLocalPlayer() && !gameMenu.isOpen()) {
    event.preventDefault();
    chat.openInput();
  }

  if (event.code === 'KeyB' && network.getLocalPlayer()) bagWindow.toggle();
  if (event.code === 'KeyV' && network.getLocalPlayer()) interfaceSettings.toggle('showAllNameplates');

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
  audio.stopMusic();
  hud.showError('The connection to the server closed. Reload the page to reconnect.', performance.now());
});

network.on('chat', (message) => chat.addMessage(message));
network.on('chatFailed', ({ message }) => chat.addSystemMessage(message));

network.on('welcome', ({ id, faction, mapId, x, y, z, rotation, serverTime }) => {
  serverClockOffsetMs = serverTime - Date.now();
  if (mapId !== activeMapId()) switchMap(mapId);
  chat.show();
  setHelpAvailable(true);
  audio.startMusic(MAPS[mapId].songId);
  player.mesh.userData.entityId = id;
  player.setPosition({ x, y, z, rotation });
  player.setAppearance(faction);
});

network.on('joinFailed', ({ message }) => characterSelect.show({ error: message }));

network.on('castStart', ({ casterId, spellId, durationMs }) => {
  const spell = SPELLS[spellId];
  getAnimator(casterId)?.startCast(SCHOOL_COLORS[spell.school]);
  if (!isLocalPlayer(casterId)) return;
  hud.startCast(spell, durationMs, performance.now());
  audio.startCastSound(durationMs / 1000);
});

network.on('castStop', ({ casterId, reason, message }) => {
  getAnimator(casterId)?.stopCast({ completed: reason === 'completed' }, performance.now());
  if (!isLocalPlayer(casterId)) return;
  audio.stopCastSound();
  hud.stopCast();
  if (reason === 'failed') hud.showError(message, performance.now());
});

network.on('castFailed', ({ message }) => hud.showError(message, performance.now()));

network.on('spellLaunch', (spellLaunch) => {
  const now = performance.now();
  const { casterId, spellId } = spellLaunch;
  const swingStyle = SWING_STYLES[spellId];
  if (swingStyle) getAnimator(casterId)?.swing(swingStyle, now);
  else if (BITE_SPELL_IDS.includes(spellId)) getAnimator(casterId)?.bite(now);
  else if (SPELLS[spellId].castTimeMs === 0) getAnimator(casterId)?.release(now);

  spellEffects.launchProjectile(spellLaunch);
  if (!isLocalPlayer(casterId)) return;
  actionBar.startCooldown(spellId, now);
  if (swingStyle) audio.playSwing(swingStyle);
  else audio.playCastRelease();
});

network.on('spellHit', (spellHit) => spellEffects.showSpellHit(spellHit, performance.now()));

// The server sends the loot window when the player opens a corpse and again after each item the player takes.
// A window that the player closed meanwhile stays closed.
network.on('lootWindow', ({ entityId, drops, copper }) => {
  const isAnswerToOpen = entityId === requestedLootCorpseId;
  if (!isAnswerToOpen && entityId !== lootWindow.getCorpseId()) return;
  requestedLootCorpseId = null;
  lootWindow.show(entityId, drops, copper);
});

network.on('lootFailed', ({ message }) => {
  requestedLootCorpseId = null;
  hud.showError(message, performance.now());
});

network.on('inventory', ({ stacks }) => {
  showQuestProgress({ questLog, stacks });
  bagStacks = stacks;
  bagWindow.setStacks(stacks);
  refreshQuestViews();
});

// As in WoW, the quest dialog closes when the player accepts the quest.
network.on('questLog', ({ quests }) => {
  const acceptedQuest = Object.keys(quests).some((questId) => !questLog[questId]);
  showQuestProgress({ questLog: quests, stacks: bagStacks });
  questLog = quests;
  if (acceptedQuest) questDialog.close();
  refreshQuestViews();
});

network.on('mapChanged', ({ mapId, x, y, z, rotation }) => {
  switchMap(mapId);
  player.setPosition({ x, y, z, rotation });
});

network.on('party', ({ party }) => partyFrames.setParty(party));
network.on('partyInvite', ({ inviterName }) => partyInvitePrompt.show(inviterName));
network.on('partyNotice', ({ message }) => chat.addPartyMessage(message));
network.on('partyFailed', ({ message }) => hud.showError(message, performance.now()));

network.on('questFailed', ({ message }) => hud.showError(message, performance.now()));

// The server sends the experience when the player joins, with no gain, and after each gain.
network.on('experience', ({ level, xp, xpGained }) => {
  const previousLevel = experience?.level;
  experience = { level, xp };
  xpBar.update(experience);
  if (xpGained > 0) chat.addExperienceMessage(xpGained);
  if (previousLevel !== undefined && level > previousLevel) {
    chat.addLevelUpMessage(level);
    audio.playLevelUp();
    hud.showQuestMessages([`You have reached level ${level}!`], performance.now());
  }
});

network.on('questCompleted', ({ questId }) => {
  const quest = QUESTS[questId];
  chat.addQuestCompletedMessage(quest.name);
  for (const { itemId, quantity } of quest.rewards.items) chat.addQuestRewardMessage(ITEMS[itemId], quantity);
});
network.on('inventoryFailed', ({ message }) => hud.showError(message, performance.now()));

network.on('money', ({ copper }) => bagWindow.setMoney(copper));
network.on('moneyLooted', ({ copper }) => {
  chat.addMoneyLootedMessage(copper);
  audio.playCoins();
});
network.on('itemBought', ({ itemId }) => {
  chat.addItemBoughtMessage(ITEMS[itemId]);
  audio.playCoins();
});
network.on('itemSold', ({ itemId, quantity, price }) => {
  chat.addItemSoldMessage(ITEMS[itemId], quantity, price);
  audio.playCoins();
});
network.on('buyback', ({ sales }) => shopWindow.setBuyback(sales));
network.on('shopFailed', ({ message }) => hud.showError(message, performance.now()));

network.on('lootReceived', ({ itemId, quantity }) => {
  chat.addLootMessage(ITEMS[itemId], quantity);
  audio.playCoins();
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
  const dayFraction = timeOfDay(Date.now() + serverClockOffsetMs);
  scenery.update(time, dayFraction, { cameraPosition: camera.position, playerPosition: player.mesh.position });
  if (lootWindow.isOpen()) closeLootWindowWhenOutOfReach();
  if (questDialog.isOpen()) closeQuestDialogWhenOutOfReach();
  if (unitMenu.isOpen() && targeting.getTarget()?.state.id !== unitMenu.getTargetId()) unitMenu.close();
  partyFrames.update(network.getLocalPlayerId(), (memberId) => network.getRemoteEntity(memberId)?.state);
  if (shopWindow.isOpen()) closeShopWhenOutOfReach();

  const target = targeting.getTarget()?.state;
  actionBar.update(time, localPlayer, target);
  hud.update({
    player: localPlayer,
    target,
    targetRelationship: localPlayer && target ? displayRelationship(localPlayer, target) : null,
    now: time,
  });
  stats.update(time, network.getPingMs(), formatClock(dayFraction));
  const remoteEntities = network.getRemoteEntities().map(({ state, mesh }) => ({ state, position: mesh.position }));
  lootSparkles.update(remoteEntities, network.getLocalPlayerId(), time);
  questMarkers.update(
    remoteEntities
      .filter(({ state }) => state.kind === 'npc')
      .map((npc) => ({ ...npc, marker: npcMarker(npc.state.id) })),
  );
  nameplates.update(
    [
      ...remoteEntities,
      ...(localPlayer ? [{ state: localPlayer, position: player.mesh.position }] : []),
    ],
    localPlayer,
    targeting.getTarget()?.state.id ?? null,
    player.mesh,
  );

  renderer.render(scene, camera);
});
