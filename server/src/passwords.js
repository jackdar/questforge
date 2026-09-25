import { randomBytes, scrypt as scryptWithCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptWithCallback);

// One hash uses 128 * COST * BLOCK_SIZE bytes of memory, which is 32 MiB here.
// Each stored hash records its own values, so a later change to these values does not break old hashes.
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const key = await deriveKey(password, salt, {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
    keyLength: KEY_LENGTH,
  });
  return ['scrypt', COST, BLOCK_SIZE, PARALLELIZATION, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, storedHash) {
  const stored = parseStoredHash(storedHash);
  if (!stored) return false;

  const key = await deriveKey(password, stored.salt, { ...stored, keyLength: stored.key.length });
  return timingSafeEqual(key, stored.key);
}

function parseStoredHash(storedHash) {
  const [algorithm, cost, blockSize, parallelization, salt, key] = String(storedHash).split('$');
  if (algorithm !== 'scrypt' || !salt || !key) return null;

  return {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelization: Number(parallelization),
    salt: Buffer.from(salt, 'base64'),
    key: Buffer.from(key, 'base64'),
  };
}

// NFKC normalization makes a password typed with a different keyboard or input method give the same hash.
function deriveKey(password, salt, { cost, blockSize, parallelization, keyLength }) {
  return scrypt(password.normalize('NFKC'), salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: MAX_MEMORY_BYTES,
  });
}
