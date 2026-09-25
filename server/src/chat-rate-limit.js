export const CHAT_MESSAGE_LIMIT = 5;
export const CHAT_WINDOW_MS = 5000;

// Each player can send a limited number of messages in a sliding time window, so that nobody can flood the chat.
export function createChatRateLimiter({ limit = CHAT_MESSAGE_LIMIT, windowMs = CHAT_WINDOW_MS } = {}) {
  const recentSendTimes = new Map();

  function tryToSend(playerId, now) {
    const sendTimes = (recentSendTimes.get(playerId) ?? []).filter((sendTime) => now - sendTime < windowMs);
    const isAllowed = sendTimes.length < limit;
    if (isAllowed) sendTimes.push(now);
    recentSendTimes.set(playerId, sendTimes);
    return isAllowed;
  }

  function forget(playerId) {
    recentSendTimes.delete(playerId);
  }

  return { tryToSend, forget };
}
