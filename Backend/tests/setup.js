// Loaded before every test file (jest "setupFiles").
// Reads Backend/.env.test (if present) BEFORE config/db.js reads .env, so tests
// never fall back to the development database credentials silently.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
