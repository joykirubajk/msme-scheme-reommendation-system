// Single source of truth for slugs and the rules vocabulary.
// Documented in docs/RULES_SCHEMA.md - keep both in sync.

export const BUSINESS_CATEGORIES = ['any', 'manufacturing', 'service', 'trading', 'agriculture', 'retail'];

export const STATES = ['all_india', 'tamil_nadu', 'karnataka', 'maharashtra', 'delhi', 'uttar_pradesh', 'other'];

export const GENDERS = ['male', 'female', 'transgender'];

export const SOCIAL_CATEGORIES = ['sc', 'st', 'obc', 'general'];

// "special categories" as used by the existing recommendation form
export const SPECIAL_CATEGORIES = ['sc_st', 'transgender', 'pwd', 'widow', 'bpl_women'];

// Ordered lowest -> highest
export const EDUCATION_LEVELS = ['none', '8th', '10th', '12th', 'diploma', 'graduation', 'postgraduation'];

// Groups that can unlock a relaxed upper age limit (rules.relaxed_age_for)
export const RELAXED_AGE_GROUPS = ['women', 'sc_st', 'sc', 'st', 'obc', 'pwd', 'transgender', 'widow', 'bpl_women'];

// Allowed keys inside schemes.rules, with the type each one must have.
export const RULE_KEYS = {
  min_age: 'number',
  max_age: 'number',
  max_age_relaxed: 'number',
  relaxed_age_for: 'array',
  genders: 'array',
  states: 'array',
  min_project_cost: 'number',
  max_project_cost: 'number',
  max_annual_income: 'number',
  min_experience_years: 'number',
  min_education: 'string',
  business_categories: 'array',
  social_categories: 'array',
  special_categories: 'array',
  max_previous_subsidy: 'number',
  is_new_enterprise_only: 'boolean',
};
