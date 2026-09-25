import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readSessionToken,
  createSessionCookie,
  createExpiredSessionCookie,
  isSameOriginRequest,
} from '../src/session-cookie.js';

test('the session token is read from among other cookies', () => {
  const request = { headers: { cookie: 'theme=dark; questforge_session=abc=123; other=1' } };

  assert.equal(readSessionToken(request), 'abc=123');
});

test('a request without a session cookie has no session token', () => {
  assert.equal(readSessionToken({ headers: {} }), null);
  assert.equal(readSessionToken({ headers: { cookie: 'theme=dark' } }), null);
});

test('a session cookie cannot be read by page scripts or sent by other sites', () => {
  const cookie = createSessionCookie('abc', { maxAgeSeconds: 60, secure: false });

  assert.equal(cookie, 'questforge_session=abc; HttpOnly; SameSite=Strict; Path=/; Max-Age=60');
});

test('a secure session cookie is sent only over HTTPS', () => {
  assert.match(createSessionCookie('abc', { maxAgeSeconds: 60, secure: true }), /; Secure$/);
});

test('an expired session cookie tells the browser to delete it', () => {
  assert.match(createExpiredSessionCookie({ secure: false }), /^questforge_session=; .*Max-Age=0$/);
});

test('a request from a page on the same host is same-origin', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'http://localhost:8080', host: 'localhost:8080' } }), true);
});

test('a request from a page on another host is not same-origin', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'https://evil.example', host: 'localhost:8080' } }), false);
});

test('a request from the same host on another port is not same-origin', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'http://localhost:5173', host: 'localhost:8080' } }), false);
});

test('a request without an Origin header is allowed', () => {
  assert.equal(isSameOriginRequest({ headers: { host: 'localhost:8080' } }), true);
});

test('a request with a malformed Origin header is not same-origin', () => {
  assert.equal(isSameOriginRequest({ headers: { origin: 'not a url', host: 'localhost:8080' } }), false);
});
