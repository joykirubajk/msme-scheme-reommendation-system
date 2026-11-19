// Applies db/schema.sql (additive + idempotent). Usage: npm run db:migrate
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(here, '..', 'db', 'schema.sql');

export async function migrate() {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await db.query(sql);
}

// Run only when executed directly (not when imported by tests)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Applying schema to database "${process.env.DB_NAME}" ...`);
    await migrate();
    console.log('Schema applied.');
    await db.pool.end();
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}
