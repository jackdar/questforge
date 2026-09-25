export const SESSION_COOKIE_NAME = 'questforge_session';

export function readSessionToken(request) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return valueParts.join('=') || null;
  }
  return null;
}

// HttpOnly keeps the token away from page scripts. SameSite=Strict keeps other sites from sending it.
// Secure needs HTTPS, so production must turn it on with SECURE_COOKIES=true.
export function createSessionCookie(token, { maxAgeSeconds, secure }) {
  const attributes = [`${SESSION_COOKIE_NAME}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/', `Max-Age=${maxAgeSeconds}`];
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

export function createExpiredSessionCookie({ secure }) {
  return createSessionCookie('', { maxAgeSeconds: 0, secure });
}

// A browser always sends an Origin header with a WebSocket handshake. Accept a handshake only from a page on this host.
// Clients that are not browsers send no Origin header, but they also cannot borrow the cookie of a player.
export function isSameOriginRequest(request) {
  const { origin, host } = request.headers;
  if (!origin) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
