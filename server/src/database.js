import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import pg from 'pg';

export function createDatabasePool(connectionString) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in, or set DATABASE_URL in the environment.');
  }

  const pool = new pg.Pool({ connectionString });
  // An idle connection can drop, for example when Postgres restarts. Log the failure so that it does not stop the server.
  pool.on('error', (error) => console.error(`An idle database connection failed: ${error.message}`));
  return pool;
}

// Postgres can take a few seconds to accept connections after its container starts, so the first attempts can fail.
export async function connectWithRetry(
  pool,
  { maxAttempts = 10, initialDelayMs = 500, maxDelayMs = 5000, log = console.log, wait = sleep } = {},
) {
  let delayMs = initialDelayMs;

  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      log('Connected to the database.');
      return;
    } catch (error) {
      const reason = describeError(error);
      if (attempt >= maxAttempts) {
        throw new Error(
          `Could not connect to the database after ${maxAttempts} attempts (${reason}). ` +
            'Make sure that Postgres runs and that DATABASE_URL is correct.',
          { cause: error },
        );
      }

      log(`Database connection attempt ${attempt} of ${maxAttempts} failed (${reason}). Next attempt in ${delayMs} ms.`);
      await wait(delayMs);
      delayMs = Math.min(delayMs * 2, maxDelayMs);
    }
  }
}

// When a host name resolves to more than one address, such as localhost to ::1 and 127.0.0.1,
// Node reports the failed connections as an AggregateError with an empty message.
function describeError(error) {
  if (error.message) return error.message;
  if (error.errors?.length) return error.errors.map(describeError).join('; ');
  return error.code ?? String(error);
}

// Each .sql file runs once, in file name order, inside its own transaction.
export async function runMigrations(pool, migrationsDirectory, { log = console.log } = {}) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const appliedMigrations = new Set(rows.map((row) => row.name));
  const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort();

  for (const file of migrationFiles) {
    if (appliedMigrations.has(file)) continue;
    const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
    await applyMigration(pool, file, sql);
    log(`Applied database migration ${file}.`);
  }
}

async function applyMigration(pool, file, sql) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Database migration ${file} failed and was rolled back: ${error.message}`, { cause: error });
  } finally {
    client.release();
  }
}
