import { showLevel } from './level-label.js';

// Each other party member gets a small frame under the player frame, with a crown for the leader.
// A member who is not in this world's snapshot, for example far away or in another map, shows as out of range.
export function createPartyFrames({ onLeave }) {
  const container = document.getElementById('party-frames');
  const list = container.querySelector('.party-frame-list');
  const framesByMemberId = new Map();
  let party = null;

  container.querySelector('[data-action="leave-party"]').addEventListener('click', onLeave);

  function setParty(newParty) {
    party = newParty;
    container.hidden = !party;
    for (const [memberId, frame] of framesByMemberId) {
      if (!party?.members.some((member) => member.id === memberId)) {
        frame.element.remove();
        framesByMemberId.delete(memberId);
      }
    }
  }

  // The frames update every frame, so that the health and mana bars follow the snapshots.
  function update(localPlayerId, stateOf) {
    if (!party) return;
    for (const member of party.members) {
      if (member.id === localPlayerId) continue;
      const frame = framesByMemberId.get(member.id) ?? addFrame(member.id);
      frame.show(member, member.id === party.leaderId, stateOf(member.id));
    }
  }

  function addFrame(memberId) {
    const element = document.createElement('div');
    element.className = 'party-frame';
    element.innerHTML = `
      <div class="party-member-name"></div>
      <div class="health-bar"><div class="health-fill"></div></div>
      <div class="mana-bar"><div class="mana-fill"></div></div>`;
    list.append(element);
    const name = element.querySelector('.party-member-name');
    const level = document.createElement('span');
    level.className = 'party-member-level';
    const healthFill = element.querySelector('.health-fill');
    const manaFill = element.querySelector('.mana-fill');

    function show(member, isLeader, state) {
      name.replaceChildren(level, `${isLeader ? '♛ ' : ''}${member.name}`);
      element.classList.toggle('out-of-range', !state);
      if (!state) {
        level.textContent = '';
        return;
      }
      showLevel(level, state.level, null);
      element.classList.toggle('dead', state.health === 0);
      healthFill.style.width = `${(state.health / state.maxHealth) * 100}%`;
      manaFill.style.width = `${(state.mana / state.maxMana) * 100}%`;
    }

    const frame = { element, show };
    framesByMemberId.set(memberId, frame);
    return frame;
  }

  return { setParty, update, getParty: () => party };
}

// An invitation shows as a small window with Accept and Decline. It closes by itself when the invitation runs out.
export function createPartyInvitePrompt({ onRespond, timeoutMs }) {
  const panel = document.getElementById('party-invite');
  const text = panel.querySelector('.party-invite-text');
  let closeTimer = null;

  panel.querySelector('[data-action="accept-invite"]').addEventListener('click', () => respond(true));
  panel.querySelector('[data-action="decline-invite"]').addEventListener('click', () => respond(false));

  function show(inviterName) {
    text.textContent = `${inviterName} invites you to join a party.`;
    panel.hidden = false;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, timeoutMs);
  }

  function respond(accepts) {
    close();
    onRespond(accepts);
  }

  function close() {
    clearTimeout(closeTimer);
    panel.hidden = true;
  }

  return { show, close };
}

// A right click on another player of the same faction opens this small menu under the target frame.
export function createUnitMenu({ onInvite }) {
  const menu = document.getElementById('unit-menu');
  const title = menu.querySelector('.unit-menu-title');
  let targetId = null;

  menu.querySelector('[data-action="invite-to-party"]').addEventListener('click', () => {
    const invitedId = targetId;
    close();
    onInvite(invitedId);
  });

  function open(entity) {
    targetId = entity.id;
    title.textContent = entity.name;
    menu.hidden = false;
  }

  function close() {
    targetId = null;
    menu.hidden = true;
  }

  return { open, close, isOpen: () => !menu.hidden, getTargetId: () => targetId };
}
