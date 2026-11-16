import dotenv from 'dotenv';
dotenv.config();


import pkg from 'pg';
const { Pool } = pkg;


if (!process.env.DB_PASSWORD) {
    console.warn("⚠️  Warning: DB_PASSWORD is missing in Backend/.env file!");
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'msme_db',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || '')
});


pool.on('connect', () => {
    console.log('Connected to local Postgres database');
});


pool.on('error', (err) => {
    console.error('Unexpected Database error', err);
    process.exit(-1);
});

export default {
    query: (text, params) => pool.query(text, params),
    pool
};