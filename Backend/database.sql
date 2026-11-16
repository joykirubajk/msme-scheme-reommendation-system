-- =======================================================
-- SMART MSME Database Schema & Tamil Nadu Schemes Dataset
-- Designed for BITS Pilani M.Tech Dissertation (Joy Mam / NIC)
-- =======================================================

-- 1. Users Table
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

-- 2. Schemes Table
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

-- 3. User Saved Schemes Table
CREATE TABLE IF NOT EXISTS user_saved_schemes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheme_id INT NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, scheme_id)
);

-- Clear existing sample records to prevent duplicates on re-run
DELETE FROM user_saved_schemes;
DELETE FROM schemes;

-- 4. Insert Comprehensive Tamil Nadu MSME Scheme Dataset
INSERT INTO schemes (id, name, description, business_category, max_investment, location, rules, benefits, beneficiary_categories)
VALUES 
(
    1,
    'NEEDS (New Entrepreneur-cum-Enterprise Development Scheme)',
    'Flagship scheme of Tamil Nadu government to assist educated youth to become first generation entrepreneurs in manufacturing or service sectors. Provides capital subsidy of 25% with 3% interest subvention for purchasing plant, machinery and equipment.',
    'manufacturing',
    50000000.00,
    'tamil_nadu',
    '{
        "min_age": 21,
        "max_age_general": 45,
        "max_age_special": 55,
        "min_education": "diploma",
        "min_project_cost": 1000000,
        "max_project_cost": 50000000,
        "target": "first_generation_entrepreneurs",
        "stage": "new",
        "purpose": "machinery"
    }',
    '{
        "subsidy_percent": 25,
        "max_subsidy": 7500000,
        "interest_subvention": "3%",
        "promoter_contribution_general": "10%",
        "promoter_contribution_special": "5%",
        "loan_assistance": "Available through TIIC and commercial banks"
    }',
    '{"general": "Eligible", "special": "SC/ST/Women/BC/MBC/Ex-servicemen/Transgender/PWD"}'
),
(
    2,
    'UYEGP (Unemployed Youth Employment Generation Programme)',
    'Micro enterprise generation scheme of Tamil Nadu designed to mitigate unemployment among socially and economically marginalized youth. Assists manufacturing (up to 15L), service (up to 5L) and business/trading (up to 5L) projects with 25% government subsidy.',
    'any',
    1500000.00,
    'tamil_nadu',
    '{
        "min_age": 18,
        "max_age_general": 45,
        "max_age_special": 55,
        "min_education": "8th",
        "max_family_income": 500000,
        "max_investment": 1500000,
        "stage": "new",
        "purpose": "working_capital"
    }',
    '{
        "subsidy_percent": 25,
        "max_subsidy": 375000,
        "margin_money": "Government subsidy treated as margin money",
        "promoter_contribution": "5% to 10%",
        "loan_type": "Composite term loan and working capital"
    }',
    '{"sc": "Eligible", "st": "Eligible", "obc": "Eligible", "general": "Eligible", "women": "Special Priority"}'
),
(
    3,
    'TWEES (Tamil Nadu Women Entrepreneurs Empowerment Scheme)',
    'Dedicated state incentive scheme empowering women and transgender entrepreneurs to establish micro and small enterprises. Provides 25% capital subsidy, handholding, EDP training, and collateral-free financial linkage across all districts of Tamil Nadu.',
    'any',
    1000000.00,
    'tamil_nadu',
    '{
        "min_age": 18,
        "max_age": 55,
        "gender": ["female", "transgender"],
        "max_project_cost": 1000000,
        "stage": "new",
        "purpose": "machinery"
    }',
    '{
        "subsidy_percent": 25,
        "max_subsidy": 250000,
        "training": "Free Entrepreneurship Development Programme (EDP)",
        "marketing_support": "Special pavilions in government trade fairs",
        "interest_subvention": "Additional 3% interest relief"
    }',
    '{"women": "100% Focused", "transgender": "Eligible", "widow": "Special Category Priority"}'
),
(
    4,
    'KKT (Kalaignar Kaivinaiyar Thittam)',
    'Special credit and financial assistance scheme for traditional artisans, craftsmen, and handloom/handicraft micro enterprises in Tamil Nadu. Provides soft loans with heavy interest subvention and equipment modernization grants.',
    'manufacturing',
    500000.00,
    'tamil_nadu',
    '{
        "min_age": 18,
        "max_project_cost": 500000,
        "stage": "existing",
        "purpose": "equipment"
    }',
    '{
        "subsidy_percent": 35,
        "max_subsidy": 175000,
        "interest_subvention": "5% on bank loans",
        "toolkit_grant": "Modern toolkit grant provided free of cost"
    }',
    '{"artisans": "Primary Focus", "sc_st": "Eligible", "obc": "Eligible"}'
),
(
    5,
    'PMEGP (Prime Minister Employment Generation Programme)',
    'Central credit-linked subsidy programme implemented through KVIC, KVIB, and DIC for generating self-employment opportunities through micro-enterprises in manufacturing (up to 50 Lakhs) and service (up to 20 Lakhs).',
    'manufacturing',
    5000000.00,
    'all_india',
    '{
        "min_age": 18,
        "min_education": "8th",
        "max_investment": 5000000,
        "stage": "new",
        "purpose": "machinery"
    }',
    '{
        "subsidy_urban_general": "15%",
        "subsidy_rural_general": "25%",
        "subsidy_special_urban": "25%",
        "subsidy_special_rural": "35%",
        "own_contribution": "5% to 10%"
    }',
    '{"general": "Eligible", "special": "SC/ST/OBC/Minorities/Women/Ex-Servicemen/PWD"}'
),
(
    6,
    'CGTMSE (Credit Guarantee Fund Trust for Micro and Small Enterprises)',
    'Provides collateral-free and third-party-guarantee-free credit facility up to ₹500 Lakhs for both new and existing Micro and Small Enterprises in manufacturing and service sectors through scheduled commercial banks.',
    'service',
    50000000.00,
    'all_india',
    '{
        "min_age": 18,
        "max_investment": 50000000,
        "stage": "existing",
        "purpose": "expansion"
    }',
    '{
        "guarantee_cover": "Up to 85% for micro-enterprises and women/SC/ST entrepreneurs",
        "loan_limit": "Up to 5 Crore without third-party collateral",
        "annual_guarantee_fee": "Concessional rates for aspiring MSMEs"
    }',
    '{"micro": "High Priority", "small": "Eligible", "women": "85% Coverage"}'
);

-- Reset sequence to match highest id
SELECT setval(pg_get_serial_sequence('schemes', 'id'), COALESCE(MAX(id), 1)) FROM schemes;
