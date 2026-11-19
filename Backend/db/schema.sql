-- MSME Scheme Recommendation Platform - database schema
--
-- ADDITIVE AND IDEMPOTENT: safe to run any number of times, on an empty database
-- or on an existing one that already has data. This file never drops, renames,
-- truncates or changes the type of anything. Run with:  npm run db:migrate

-- ---------------------------------------------------------------- users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(15),
    reset_otp VARCHAR(6),
    reset_otp_expires TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------- schemes
CREATE TABLE IF NOT EXISTS schemes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    business_category VARCHAR(100),
    max_investment DECIMAL(15, 2),
    location VARCHAR(100),
    rules JSON,
    benefits JSON,
    beneficiary_categories JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data-provenance columns (added so unverified seed data can never pass as official).
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS official_source TEXT;

CREATE INDEX IF NOT EXISTS idx_schemes_business_category ON schemes (business_category);
CREATE INDEX IF NOT EXISTS idx_schemes_location ON schemes (location);
CREATE INDEX IF NOT EXISTS idx_schemes_name ON schemes (name);

-- ---------------------------------------------------------------- saved schemes
CREATE TABLE IF NOT EXISTS user_saved_schemes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, scheme_id)
);

-- saveScheme() relies on ON CONFLICT (user_id, scheme_id); guarantee the constraint
-- exists even if the table was created by hand without it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_saved_schemes_user_scheme
    ON user_saved_schemes (user_id, scheme_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_schemes_user ON user_saved_schemes (user_id);

-- ---------------------------------------------------------------- business profile (used from Phase 3)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    age INT,
    gender VARCHAR(20),
    social_category VARCHAR(20),
    special_category VARCHAR(30),
    business_category VARCHAR(100),
    investment DECIMAL(15, 2),
    state VARCHAR(100),
    annual_income DECIMAL(15, 2),
    education VARCHAR(30),
    experience_years INT,
    business_description TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Phase 3 (additive): "are you starting a new enterprise?"
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_new_enterprise BOOLEAN;

-- ---------------------------------------------------------------- legacy-dump repairs
-- The original dev dump (msme_09112026.sql) was created by hand: no UNIQUE on
-- users.email, no schemes.updated_at, and its sequences were reset below the
-- existing ids. These statements are no-ops on a database built from this file.
ALTER TABLE schemes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);
SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM users), 1), (SELECT COUNT(*) > 0 FROM users));
SELECT setval(pg_get_serial_sequence('schemes', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM schemes), 1), (SELECT COUNT(*) > 0 FROM schemes));
SELECT setval(pg_get_serial_sequence('user_saved_schemes', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM user_saved_schemes), 1), (SELECT COUNT(*) > 0 FROM user_saved_schemes));

-- ---------------------------------------------------------------- discovery indexes (Phase 5)
CREATE INDEX IF NOT EXISTS idx_schemes_name_lower ON schemes (LOWER(name));
