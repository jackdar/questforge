import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatRateLimiter, CHAT_MESSAGE_LIMIT, CHAT_WINDOW_MS } from '../src/chat-rate-limit.js';

test('a player can send up to the limit of messages in one window', () => {
  const limiter = createChatRateLimiter();

  const results = Array.from({ length: CHAT_MESSAGE_LIMIT }, (_, index) => limiter.tryToSend('alice', index));

  assert.deepEqual(results, Array(CHAT_MESSAGE_LIMIT).fill(true));
});

test('a message over the limit in one window is refused', () => {
  const limiter = createChatRateLimiter();
  for (let index = 0; index < CHAT_MESSAGE_LIMIT; index++) limiter.tryToSend('alice', index);

  assert.equal(limiter.tryToSend('alice', CHAT_MESSAGE_LIMIT), false);
});

test('a player can send again once the oldest message leaves the window', () => {
  const limiter = createChatRateLimiter();
  for (let index = 0; index < CHAT_MESSAGE_LIMIT; index++) limiter.tryToSend('alice', index);

  assert.equal(limiter.tryToSend('alice', CHAT_WINDOW_MS - 1), false);
  assert.equal(limiter.tryToSend('alice', CHAT_WINDOW_MS), true);
});

test('each player has their own limit', () => {
  const limiter = createChatRateLimiter();
  for (let index = 0; index < CHAT_MESSAGE_LIMIT; index++) limiter.tryToSend('alice', index);

  assert.equal(limiter.tryToSend('bob', CHAT_MESSAGE_LIMIT), true);
});

test('a forgotten player starts with a full limit again', () => {
  const limiter = createChatRateLimiter();
  for (let index = 0; index < CHAT_MESSAGE_LIMIT; index++) limiter.tryToSend('alice', index);

  limiter.forget('alice');

  assert.equal(limiter.tryToSend('alice', CHAT_MESSAGE_LIMIT), true);
});
