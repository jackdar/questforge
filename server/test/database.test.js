import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabasePool, connectWithRetry, runMigrations } from '../src/database.js';
import { databaseTestOptions, createTestSchema } from './test-database.js';

test('creating a pool without a connection string explains how to set one', () => {
  assert.throws(() => createDatabasePool(undefined), /DATABASE_URL is not set\. Copy \.env\.example to \.env/);
});

test('connecting succeeds after earlier attempts fail', async () => {
  let attempts = 0;
  const pool = {
    query: async () => {
      attempts++;
      if (attempts < 3) throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
    },
  };

  await connectWithRetry(pool, { log: () => {}, wait: async () => {} });

  assert.equal(attempts, 3);
});

test('connecting waits twice as long after each failure, up to the maximum delay', async () => {
  const waits = [];
  const pool = {
    query: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
    },
  };

  await assert.rejects(
    connectWithRetry(pool, {
      maxAttempts: 6,
      initialDelayMs: 500,
      maxDelayMs: 3000,
      log: () => {},
      wait: async (delayMs) => waits.push(delayMs),
    }),
  );

  assert.deepEqual(waits, [500, 1000, 2000, 3000, 3000]);
});

test('connecting gives up after the last attempt with the cause and a fix', async () => {
  const pool = {
    query: async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
    },
  };

  await assert.rejects(
    connectWithRetry(pool, { maxAttempts: 3, log: () => {}, wait: async () => {} }),
    /after 3 attempts \(connect ECONNREFUSED 127\.0\.0\.1:5432\)\. Make sure that Postgres runs and that DATABASE_URL is correct\./,
  );
});

test('a failed connection to several addresses reports each address', async () => {
  const pool = {
    query: async () => {
      throw new AggregateError(
        [new Error('connect ECONNREFUSED ::1:5432'), new Error('connect ECONNREFUSED 127.0.0.1:5432')],
        '',
      );
    },
  };

  await assert.rejects(
    connectWithRetry(pool, { maxAttempts: 1, log: () => {}, wait: async () => {} }),
    /\(connect ECONNREFUSED ::1:5432; connect ECONNREFUSED 127\.0\.0\.1:5432\)/,
  );
});

describe('migrations', databaseTestOptions, () => {
  let testSchema;
  let schema;
  let pool;
  let migrationsDirectory;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    ({ schema, pool } = testSchema);
    migrationsDirectory = await mkdtemp(path.join(tmpdir(), 'questforge-migrations-'));
  });

  afterEach(async () => {
    await testSchema.drop();
    await rm(migrationsDirectory, { recursive: true });
  });

  test('migrations run in file name order and are recorded', async () => {
    await writeFile(path.join(migrationsDirectory, '002_books.sql'), 'CREATE TABLE books (author_id int REFERENCES authors);');
    await writeFile(path.join(migrationsDirectory, '001_authors.sql'), 'CREATE TABLE authors (id int PRIMARY KEY);');
    await writeFile(path.join(migrationsDirectory, 'notes.txt'), 'This is not SQL.');

    await runMigrations(pool, migrationsDirectory, { log: () => {} });

    const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');
    assert.deepEqual(rows.map((row) => row.name), ['001_authors.sql', '002_books.sql']);
  });

  test('running migrations again does not apply them a second time', async () => {
    await writeFile(path.join(migrationsDirectory, '001_authors.sql'), 'CREATE TABLE authors (id int PRIMARY KEY);');
    await runMigrations(pool, migrationsDirectory, { log: () => {} });

    await runMigrations(pool, migrationsDirectory, { log: () => {} });

    const { rows } = await pool.query('SELECT count(*)::int AS count FROM schema_migrations');
    assert.equal(rows[0].count, 1);
  });

  test('a failing migration is rolled back and its error names the file', async () => {
    await writeFile(path.join(migrationsDirectory, '001_authors.sql'), 'CREATE TABLE authors (id int PRIMARY KEY);');
    await writeFile(path.join(migrationsDirectory, '002_broken.sql'), 'CREATE TABLE books (id int); SELEC 1;');

    await assert.rejects(
      runMigrations(pool, migrationsDirectory, { log: () => {} }),
      /Database migration 002_broken\.sql failed and was rolled back/,
    );

    const { rows: migrations } = await pool.query('SELECT name FROM schema_migrations');
    const { rows: tables } = await pool.query('SELECT to_regclass($1) AS books', [`${schema}.books`]);
    assert.deepEqual(migrations.map((row) => row.name), ['001_authors.sql']);
    assert.equal(tables[0].books, null);
  });
});
