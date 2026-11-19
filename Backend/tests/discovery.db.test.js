// Discovery SQL against a real database. Runs ONLY on a reachable DB named *_test,
// otherwise each test logs SKIPPED and returns.
import request from 'supertest';
import app from '../app.js';
import db from '../config/db.js';
import { migrate } from '../scripts/migrate.js';
import { seed } from '../scripts/seed.js';

const isTestDb = (process.env.DB_NAME || '').endsWith('_test');
let reachable = false;

beforeAll(async () => {
  if (!isTestDb) return;
  try {
    await db.query('SELECT 1');
    reachable = true;
    await migrate();
    await seed();
  } catch {
    reachable = false;
  }
});
afterAll(async () => { await db.pool.end(); });

const maybe = (name, fn) => test(name, async () => {
  if (!isTestDb || !reachable) {
    console.warn(`SKIPPED "${name}": needs a reachable DB named *_test`);
    return;
  }
  await fn();
});

const list = async (qs = '') => {
  const res = await request(app).get(`/api/schemes${qs}`);
  expect(res.status).toBe(200);
  return res.body.data;
};

describe('discovery against Postgres', () => {
  maybe('no filters: paginated, name order, total matches table', async () => {
    const total = (await db.query('SELECT COUNT(*)::int AS n FROM schemes')).rows[0].n;
    const d = await list('?limit=5');
    expect(d.pagination.total).toBe(total);
    expect(d.schemes).toHaveLength(Math.min(5, total));
    const names = d.schemes.map((s) => s.name.toLowerCase());
    expect([...names].sort()).toEqual(names);
  });

  maybe('pages do not overlap and cover everything', async () => {
    const first = await list('?limit=50');
    const seen = new Set();
    for (let page = 1; page <= Math.ceil(first.pagination.total / 7); page += 1) {
      (await list(`?limit=7&page=${page}`)).schemes.forEach((s) => {
        expect(seen.has(s.id)).toBe(false);
        seen.add(s.id);
      });
    }
    expect(seen.size).toBe(first.pagination.total);
  });

  maybe('state filter returns that state plus all-India only', async () => {
    const d = await list('?state=tamil_nadu&limit=50');
    expect(d.schemes.length).toBeGreaterThan(0);
    d.schemes.forEach((s) => expect(['tamil_nadu', 'all_india']).toContain(s.location));
    expect(d.schemes.some((s) => s.location === 'tamil_nadu')).toBe(true);
  });

  maybe('category filter excludes schemes restricted to other categories', async () => {
    const d = await list('?category=agriculture&limit=50');
    d.schemes.forEach((s) => {
      const cats = s.rules && s.rules.business_categories;
      const ok = s.business_category === 'agriculture'
        || (s.business_category === 'any' && (!Array.isArray(cats) || cats.includes('agriculture')));
      expect(ok).toBe(true);
    });
    expect(d.schemes.some((s) => s.business_category === 'agriculture')).toBe(true);
  });

  maybe('keyword search is case-insensitive', async () => {
    const d = await list('?q=mudra');
    expect(d.schemes.length).toBeGreaterThan(0);
    d.schemes.forEach((s) => expect(`${s.name} ${s.description}`.toLowerCase()).toContain('mudra'));
  });

  maybe('LIKE wildcards and quotes are treated literally (no injection)', async () => {
    expect((await list('?q=%25')).pagination.total).toBe(0); // literal "%"
    expect((await list('?q=_')).pagination.total).toBe(0);
    expect((await list(`?q=${encodeURIComponent("' OR 1=1 --")}`)).pagination.total).toBe(0);
    const still = (await db.query('SELECT COUNT(*)::int AS n FROM schemes')).rows[0].n;
    expect(still).toBeGreaterThan(0);
  });

  maybe('investment filter keeps only schemes whose range fits', async () => {
    const d = await list('?investment=100000000&limit=50');
    d.schemes.forEach((s) => expect(s.max_investment === null || Number(s.max_investment) >= 100000000).toBe(true));
  });

  // Compare against the same rule computed in JS over every row, so rows that are wrongly
  // DROPPED are caught too (not only rows wrongly returned).
  test.each([[30000], [50000], [500000], [1000001], [100000000]])('investment=%i returns exactly the fitting schemes', async (inv) => {
    if (!isTestDb || !reachable) return;
    const all = (await db.query('SELECT id, max_investment, rules FROM schemes')).rows;
    const fits = (s) => {
      const rules = typeof s.rules === 'string' ? JSON.parse(s.rules) : s.rules || {};
      const min = Number(rules.min_project_cost);
      return (s.max_investment === null || Number(s.max_investment) >= inv)
        && (rules.min_project_cost === undefined || !Number.isFinite(min) || min <= inv);
    };
    const expected = all.filter(fits).map((s) => s.id).sort((a, b) => a - b);
    const got = (await list(`?investment=${inv}&limit=50`)).schemes.map((s) => s.id).sort((a, b) => a - b);
    expect(got).toEqual(expected);
  });

  maybe('Tamil Nadu + manufacturing + 5 lakh returns several schemes', async () => {
    const d = await list('?state=tamil_nadu&category=manufacturing&investment=500000&limit=50');
    expect(d.pagination.total).toBeGreaterThan(5);
  });

  maybe('sort by investment desc', async () => {
    const vals = (await list('?sort=investment&order=desc&limit=50')).schemes
      .map((s) => s.max_investment).filter((v) => v !== null).map(Number);
    expect([...vals].sort((a, b) => b - a)).toEqual(vals);
  });

  maybe('combined filters narrow results', async () => {
    const all = (await list('?state=tamil_nadu&limit=50')).pagination.total;
    const both = (await list('?state=tamil_nadu&category=manufacturing&limit=50')).pagination.total;
    expect(both).toBeLessThanOrEqual(all);
  });

  maybe('filters endpoint lists real values from the data', async () => {
    const res = await request(app).get('/api/schemes/filters');
    expect(res.status).toBe(200);
    expect(res.body.data.locations).toContain('tamil_nadu');
    expect(res.body.data.locations).not.toContain('all_india');
    expect(res.body.data.categories).toContain('manufacturing');
    expect(res.body.data.categories).toContain('service'); // only appears inside rules
    expect(res.body.data.categories).not.toContain('any');
  });

  maybe('GET /:id returns a row, 404 for a missing id', async () => {
    const { id } = (await db.query('SELECT id FROM schemes ORDER BY id LIMIT 1')).rows[0];
    const ok = await request(app).get(`/api/schemes/${id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe(id);
    expect((await request(app).get('/api/schemes/2147483647')).status).toBe(404);
  });
});
