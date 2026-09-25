export const MAX_PARTY_SIZE = 5;
export const INVITE_TIMEOUT_MS = 60000;
// A party member this close to a kill shares its xp, its quest credit, and its loot, as in WoW.
export const KILL_SHARE_RANGE = 60;

// Parties live in memory for as long as their members are in the world. A party has a leader and a list of members,
// and each member is { id, name }. A player who invites someone without a party becomes the leader of a new party.
export function createParties() {
  const partyByPlayerId = new Map();
  const invitesByInviteeId = new Map();

  function invite(inviter, invitee, now) {
    if (invitee?.kind !== 'player' || invitee.id === inviter.id) {
      return { error: 'You can only invite another player.' };
    }
    if (invitee.faction !== inviter.faction) return { error: 'You can only invite a player of your own faction.' };
    if (partyByPlayerId.has(invitee.id)) return { error: `${invitee.name} is already in a party.` };
    if (membersOf(inviter.id).length >= MAX_PARTY_SIZE) return { error: 'Your party is full.' };

    const pendingInvite = { inviter: { id: inviter.id, name: inviter.name }, expiresAt: now + INVITE_TIMEOUT_MS };
    invitesByInviteeId.set(invitee.id, pendingInvite);
    return { ok: true };
  }

  // Returns the party that the invitee joined, or the inviter that the invitee declined.
  function respond(invitee, accepts, now) {
    const pendingInvite = invitesByInviteeId.get(invitee.id);
    invitesByInviteeId.delete(invitee.id);
    if (!pendingInvite || now > pendingInvite.expiresAt) return { error: 'You have no party invitation.' };
    const { inviter } = pendingInvite;
    if (!accepts) return { declinedInviter: inviter };
    if (membersOf(inviter.id).length >= MAX_PARTY_SIZE) return { error: 'That party is full.' };

    const party = partyByPlayerId.get(inviter.id) ?? { leaderId: inviter.id, members: [inviter] };
    party.members.push({ id: invitee.id, name: invitee.name });
    for (const member of party.members) partyByPlayerId.set(member.id, party);
    return { party: copyParty(party) };
  }

  // Returns the party that is left, or null when the party broke up because only one member stayed.
  function leave(playerId) {
    invitesByInviteeId.delete(playerId);
    const party = partyByPlayerId.get(playerId);
    if (!party) return { remainingParty: null, formerMemberIds: [] };

    partyByPlayerId.delete(playerId);
    party.members = party.members.filter((member) => member.id !== playerId);
    if (party.leaderId === playerId) party.leaderId = party.members[0].id;
    const formerMemberIds = party.members.map((member) => member.id);
    if (party.members.length > 1) return { remainingParty: copyParty(party), formerMemberIds };

    for (const member of party.members) partyByPlayerId.delete(member.id);
    return { remainingParty: null, formerMemberIds };
  }

  function partyOf(playerId) {
    const party = partyByPlayerId.get(playerId);
    return party ? copyParty(party) : null;
  }

  // A player without a party counts as a party of one.
  function membersOf(playerId) {
    return partyByPlayerId.get(playerId)?.members.map((member) => member.id) ?? [playerId];
  }

  return { invite, respond, leave, partyOf, membersOf };
}

// The tagger always shares the kill. The other members share it when they are alive and near the kill.
export function playersSharingKill(taggerId, corpse, world, parties) {
  return parties
    .membersOf(taggerId)
    .map((memberId) => world.getEntity(memberId))
    .filter((member) => {
      if (!member) return false;
      if (member.id === taggerId) return true;
      const distance = Math.hypot(member.x - corpse.x, member.z - corpse.z);
      return member.health > 0 && distance <= KILL_SHARE_RANGE;
    });
}

function copyParty(party) {
  return { leaderId: party.leaderId, members: party.members.map((member) => ({ ...member })) };
}
