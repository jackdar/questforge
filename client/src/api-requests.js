const NETWORK_ERROR = 'Could not reach the server. Check that it runs, then try again.';

export function fetchSession() {
  return sendRequest('GET', '/api/session');
}

export function register(username, password) {
  return sendRequest('POST', '/api/register', { username, password });
}

export function login(username, password) {
  return sendRequest('POST', '/api/login', { username, password });
}

export function logout() {
  return sendRequest('POST', '/api/logout');
}

export function fetchCharacters() {
  return sendRequest('GET', '/api/characters');
}

export function createCharacter(name, faction) {
  return sendRequest('POST', '/api/characters', { name, faction });
}

async function sendRequest(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  if (response.status === 204) return { ok: true };
  const data = await response.json().catch(() => ({}));
  if (response.ok) return { ok: true, ...data };
  return { ok: false, error: data.error ?? `The server answered with status ${response.status}.` };
}
