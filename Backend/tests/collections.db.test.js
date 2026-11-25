// Collections / favourites against a real database (*_test only; otherwise SKIPPED).
import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed.js';
import { reconcileLegacy } from '../scripts/reconcileLegacy.js';
import { authHeader } from './helpers.js';

const isTestDb = (process.env.DB_NAME || '').endsWith('_test');
let reachable = false;
let userId;
let schemeIds;

const makeUser = async (email) => (await db.query(
  `INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', 'Test User')
   ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  [email]
)).rows[0].id;

beforeAll(async () => {
  if (!isTestDb) return;
  try {
    await db.query('SELECT 1');
    reachable = true;
    await migrate();
    await seed();
    userId = await makeUser('collections-test@example.com');
    await db.query('DELETE FROM user_saved_schemes WHERE user_id = $1', [userId]);
    schemeIds = (await db.query('SELECT id FROM schemes ORDER BY id LIMIT 3')).rows.map((r) => r.id);
  } catch {
    reachable = false;
  }
});
afterAll(async () => {
  if (reachable) await db.query('DELETE FROM users WHERE email LIKE $1', ['%-test@example.com']);
  await db.pool.end();
});

const maybe = (name, fn) => test(name, async () => {
  if (!isTestDb || !reachable) {
    console.warn(`SKIPPED "${name}": needs a reachable DB named *_test`);
    return;
  }
  await fn();
});

const save = (id, uid = userId) => request(app).post('/api/users/schemes/save').set(authHeader(uid)).send({ scheme_id: id });
const ids = async (uid = userId) => (await request(app).get('/api/users/schemes/saved/ids').set(authHeader(uid))).body.data.ids;

describe('collections against Postgres', () => {
  maybe('requires auth', async () => {
    expect((await request(app).get('/api/users/schemes/saved/ids')).status).toBe(401);
    expect((await request(app).post('/api/users/schemes/save').send({ scheme_id: 1 })).status).toBe(401);
  });

  maybe('save is idempotent: double save keeps one row', async () => {
    const first = await save(schemeIds[0]);
    const second = await save(schemeIds[0]);
    expect(first.status).toBe(200);
    expect(first.body.data.created).toBe(true);
    expect(second.status).toBe(200);
    expect(second.body.data.created).toBe(false);
    const n = await db.query('SELECT COUNT(*)::int AS n FROM user_saved_schemes WHERE user_id = $1 AND scheme_id = $2', [userId, schemeIds[0]]);
    expect(n.rows[0].n).toBe(1);
  });

  maybe('ids endpoint returns every saved id in one call', async () => {
    await save(schemeIds[1]);
    expect(await ids()).toEqual([schemeIds[0], schemeIds[1]].sort((a, b) => a - b));
  });

  maybe('saved list returns full schemes, newest first', async () => {
    const res = await request(app).get('/api/users/schemes/saved').set(authHeader(userId));
    expect(res.status).toBe(200);
    expect(res.body.data.schemes.map((s) => s.id)).toEqual([schemeIds[1], schemeIds[0]]);
    expect(res.body.data.schemes[0].name).toBeTruthy();
  });

  maybe('check endpoint', async () => {
    const yes = await request(app).get(`/api/users/schemes/save/${schemeIds[0]}`).set(authHeader(userId));
    const no = await request(app).get(`/api/users/schemes/save/${schemeIds[2]}`).set(authHeader(userId));
    expect(yes.body.data.isSaved).toBe(true);
    expect(no.body.data.isSaved).toBe(false);
  });

  maybe('unsave is idempotent', async () => {
    const a = await request(app).delete(`/api/users/schemes/save/${schemeIds[1]}`).set(authHeader(userId));
    const b = await request(app).delete(`/api/users/schemes/save/${schemeIds[1]}`).set(authHeader(userId));
    expect(a.body.data.removed).toBe(true);
    expect(b.status).toBe(200);
    expect(b.body.data.removed).toBe(false);
    expect(await ids()).toEqual([schemeIds[0]]);
  });

  maybe('invalid ids -> 400, unknown scheme -> 404', async () => {
    expect((await save('abc')).status).toBe(400);
    expect((await save(-1)).status).toBe(400);
    expect((await save(undefined)).status).toBe(400);
    expect((await save(2147483647)).status).toBe(404);
    expect((await request(app).delete('/api/users/schemes/save/xyz').set(authHeader(userId))).status).toBe(400);
  });

  maybe('token for a deleted user -> 401, not 500', async () => {
    const ghost = await makeUser('ghost-test@example.com');
    await db.query('DELETE FROM users WHERE id = $1', [ghost]);
    expect((await save(schemeIds[0], ghost)).status).toBe(401);
  });

  maybe('deleting a user cascades to saved schemes', async () => {
    const temp = await makeUser('cascade-test@example.com');
    await save(schemeIds[0], temp);
    await db.query('DELETE FROM users WHERE id = $1', [temp]);
    const n = await db.query('SELECT COUNT(*)::int AS n FROM user_saved_schemes WHERE user_id = $1', [temp]);
    expect(n.rows[0].n).toBe(0);
  });

  maybe('reconcile-legacy moves saves from a legacy row to its seeded twin', async () => {
    const legacy = (await db.query(
      `INSERT INTO schemes (name, description, location) VALUES ('KKT', 'legacy row', 'tamil_nadu') RETURNING id`
    )).rows[0].id;
    const twin = (await db.query(`SELECT id FROM schemes WHERE name = 'KKT - Kalaignar Kaivinai Thittam'`)).rows[0].id;
    await save(legacy);
    await reconcileLegacy();
    expect((await db.query('SELECT 1 FROM schemes WHERE id = $1', [legacy])).rows).toHaveLength(0);
    expect(await ids()).toContain(twin);
    expect(await reconcileLegacy()).toEqual([]); // idempotent
  });
});
