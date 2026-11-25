// Inserts the placeholder schemes from db/seed/schemes.data.json.
// Usage: npm run db:seed
//
// SAFE FOR EXISTING DATA: a scheme is inserted only if no scheme with the same name
// exists. Existing rows are never updated, deleted or truncated.
// All seed rows are verified=false (see docs/DATA_VERIFICATION.md).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import { validateSchemes } from '../db/seed/validateSeed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(here, '..', 'db', 'seed', 'schemes.data.json');

export async function seed() {
  const schemes = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const problems = validateSchemes(schemes);
  if (problems.length) {
    throw new Error(`Seed data invalid:\n - ${problems.join('\n - ')}`);
  }

  let inserted = 0;
  for (const s of schemes) {
    const result = await db.query(
      `INSERT INTO schemes
         (name, description, business_category, max_investment, location,
          rules, benefits, beneficiary_categories, verified, official_source)
       SELECT $1::text, $2, $3, $4, $5, $6, $7, $8, FALSE, $9
       WHERE NOT EXISTS (SELECT 1 FROM schemes WHERE name = $1::text)`,
      [
        s.name, s.description, s.business_category, s.max_investment, s.location,
        JSON.stringify(s.rules), JSON.stringify(s.benefits), JSON.stringify(s.beneficiary_categories),
        s.official_source,
      ]
    );
    inserted += result.rowCount;
  }
  return { total: schemes.length, inserted, skipped: schemes.length - inserted };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Seeding database "${process.env.DB_NAME}" ...`);
    const r = await seed();
    console.log(`Seed done: ${r.inserted} inserted, ${r.skipped} already present (of ${r.total}).`);
    console.log('WARNING: all seeded schemes are UNVERIFIED placeholders. See docs/DATA_VERIFICATION.md.');
    await db.pool.end();
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}
