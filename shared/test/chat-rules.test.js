import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanChatMessage, CHAT_MAX_LENGTH } from '../chat-rules.js';

test('a message keeps its text without the spaces around it', () => {
  assert.deepEqual(cleanChatMessage('  hello there  '), { text: 'hello there' });
});

test('a new line or a tab in a message becomes a space', () => {
  assert.deepEqual(cleanChatMessage('hello\nthere\tfriend'), { text: 'hello there friend' });
});

test('a message that is empty after cleaning is rejected', () => {
  assert.deepEqual(cleanChatMessage(' \n\t '), { error: 'A chat message cannot be empty.' });
});

test('a message at the maximum length is accepted', () => {
  assert.equal(cleanChatMessage('a'.repeat(CHAT_MAX_LENGTH)).text.length, CHAT_MAX_LENGTH);
});

test('a message longer than the maximum is rejected', () => {
  assert.deepEqual(cleanChatMessage('a'.repeat(CHAT_MAX_LENGTH + 1)), {
    error: 'A chat message can have at most 255 characters.',
  });
});

test('a message that is not text is rejected', () => {
  assert.deepEqual(cleanChatMessage({ html: '<b>hi</b>' }), { error: 'A chat message must be text.' });
});
