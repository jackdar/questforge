import { createHash, randomBytes } from 'node:crypto';

export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60;

const UNIQUE_VIOLATION = '23505';

export function createAccountStore(pool) {
  async function createAccount(username, passwordHash) {
    try {
      const { rows } = await pool.query(
        'INSERT INTO accounts (username, password_hash) VALUES ($1, $2) RETURNING id, username',
        [username, passwordHash],
      );
      return { account: toAccount(rows[0]) };
    } catch (error) {
      if (error.code === UNIQUE_VIOLATION) return { error: 'That username is taken.' };
      throw error;
    }
  }

  async function findAccountForLogin(username) {
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM accounts WHERE lower(username) = lower($1)',
      [username],
    );
    return rows[0] ? { ...toAccount(rows[0]), passwordHash: rows[0].password_hash } : null;
  }

  async function createSession(accountId, { lifetimeSeconds = SESSION_LIFETIME_SECONDS } = {}) {
    const token = randomBytes(32).toString('base64url');
    await pool.query('DELETE FROM sessions WHERE expires_at < now()');
    await pool.query(
      'INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))',
      [hashToken(token), accountId, lifetimeSeconds],
    );
    return token;
  }

  async function findAccountBySession(token) {
    if (!token) return null;
    const { rows } = await pool.query(
      `SELECT accounts.id, accounts.username
       FROM sessions JOIN accounts ON accounts.id = sessions.account_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [hashToken(token)],
    );
    return rows[0] ? toAccount(rows[0]) : null;
  }

  async function deleteSession(token) {
    if (!token) return;
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }

  return { createAccount, findAccountForLogin, createSession, findAccountBySession, deleteSession };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function toAccount(row) {
  return { id: String(row.id), username: row.username };
}
