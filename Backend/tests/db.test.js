// Database tests. They run ONLY against a database whose name ends in "_test"
// and that is reachable; otherwise they are skipped (reported as skipped, not passed).
import db from '../config/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed.js';

const dbName = process.env.DB_NAME || '';
const isTestDb = dbName.endsWith('_test');

let reachable = false;
beforeAll(async () => {
  if (!isTestDb) return;
  try {
    await db.query('SELECT 1');
    reachable = true;
  } catch {
    reachable = false;
  }
});

afterAll(async () => {
  await db.pool.end();
});

const maybe = (name, fn) =>
  test(name, async () => {
    if (!isTestDb || !reachable) {
      console.warn(`SKIPPED "${name}": needs a reachable DB named *_test (DB_NAME="${dbName}")`);
      return;
    }
    await fn();
  });

describe('database (needs Postgres + *_test database)', () => {
  maybe('migrate is idempotent (run twice)', async () => {
    await migrate();
    await migrate();
    const t = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_name = ANY($1)`,
      [['users', 'schemes', 'user_saved_schemes', 'user_profiles']]
    );
    expect(t.rows.length).toBe(4);
  });

  maybe('seed is idempotent and inserts only unverified rows', async () => {
    const first = await seed();
    const second = await seed();
    expect(second.inserted).toBe(0);
    expect(first.total).toBe(second.total);
    const r = await db.query('SELECT COUNT(*)::int AS n FROM schemes WHERE verified = TRUE');
    expect(r.rows[0].n).toBe(0);
  });
});
