// One-off clean-up after restoring the original dev dump (msme_09112026.sql).
//
// That dump holds five hand-entered Tamil Nadu schemes with short names (TWEES, NEEDS, ...)
// and old rule keys. Their normalised versions now live in db/seed/schemes.data.json, so after
// `npm run db:seed` each legacy row has a seeded twin. This script, in ONE transaction:
//   1. moves any saved-scheme rows from the legacy row to its seeded twin (no duplicates),
//   2. deletes the legacy row.
// Users and their passwords from the dump are left untouched.
// Idempotent: running it again finds nothing to do. Usage: npm run db:reconcile-legacy
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

export const LEGACY_TO_SEED = {
  TWEES: 'TWEES - Tamil Nadu Women Entrepreneurs Empowerment Scheme',
  NEEDS: 'Tamil Nadu NEEDS - New Entrepreneur-cum-Enterprise Development Scheme',
  UYEGP: 'Tamil Nadu UYEGP - Unemployed Youth Employment Generation Programme',
  AABCS: 'AABCS - Annal Ambedkar Business Champions Scheme',
  KKT: 'KKT - Kalaignar Kaivinai Thittam',
};

export async function reconcileLegacy() {
  const client = await db.pool.connect();
  const report = [];
  try {
    await client.query('BEGIN');
    for (const [legacyName, seedName] of Object.entries(LEGACY_TO_SEED)) {
      const legacy = await client.query('SELECT id FROM schemes WHERE name = $1', [legacyName]);
      if (legacy.rows.length === 0) continue;
      const twin = await client.query('SELECT id FROM schemes WHERE name = $1', [seedName]);
      if (twin.rows.length === 0) {
        report.push(`${legacyName}: kept (run "npm run db:seed" first - no seeded twin found)`);
        continue;
      }
      const twinId = twin.rows[0].id;
      for (const { id: legacyId } of legacy.rows) {
        const moved = await client.query(
          `INSERT INTO user_saved_schemes (user_id, scheme_id, saved_at)
             SELECT user_id, $2, saved_at FROM user_saved_schemes WHERE scheme_id = $1
           ON CONFLICT (user_id, scheme_id) DO NOTHING`,
          [legacyId, twinId]
        );
        await client.query('DELETE FROM schemes WHERE id = $1', [legacyId]);
        report.push(`${legacyName} (id ${legacyId}) -> replaced by id ${twinId}, ${moved.rowCount} saved row(s) moved`);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Reconciling legacy schemes in database "${process.env.DB_NAME}" ...`);
    const report = await reconcileLegacy();
    console.log(report.length ? report.join('\n') : 'Nothing to do.');
    await db.pool.end();
  } catch (err) {
    console.error('Reconcile failed:', err.message);
    process.exit(1);
  }
}
