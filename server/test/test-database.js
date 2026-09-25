import { randomUUID } from 'node:crypto';
import pg from 'pg';

export const databaseTestOptions = {
  skip: process.env.TEST_DATABASE_URL ? false : 'Set TEST_DATABASE_URL to run the database tests.',
};

// Each test gets its own schema, so that the tests cannot see each other's tables.
export async function createTestSchema() {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const adminPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });

  async function drop() {
    await pool.end();
    await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
    await adminPool.end();
  }

  return { schema, pool, drop };
}
