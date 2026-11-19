import { BUSINESS_CATEGORIES, GENDERS, SOCIAL_CATEGORIES, SPECIAL_CATEGORIES, EDUCATION_LEVELS } from './constants.js';

const absent = (v) => v === undefined || v === null || v === '';

const intRange = (min, max) => (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max
    ? { value: n }
    : { error: `must be a whole number between ${min} and ${max}` };
};

const money = (raw) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 1e12 ? { value: n } : { error: 'must be a non-negative number' };
};

const oneOf = (list) => (raw) => {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return list.includes(v) ? { value: v } : { error: `must be one of: ${list.join(', ')}` };
};

const stateSlug = (raw) => {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  return /^[a-z_]{2,50}$/.test(v) && v !== 'all_india' ? { value: v } : { error: 'must be a valid state name' };
};

const text = (max) => (raw) => {
  const v = typeof raw === 'string' ? raw.trim() : '';
  return v.length > 0 && v.length <= max ? { value: v } : { error: `must be text of at most ${max} characters` };
};

const bool = (raw) => {
  if (raw === true || raw === 'true') return { value: true };
  if (raw === false || raw === 'false') return { value: false };
  return { error: 'must be true or false' };
};

// field -> [isCore, checker]. Core fields are the five the eligibility engine needs.
const PROFILE_FIELDS = {
  age: [true, intRange(18, 100)],
  gender: [true, oneOf(GENDERS)],
  business_category: [true, oneOf(BUSINESS_CATEGORIES)],
  investment: [true, money],
  state: [true, stateSlug],
  social_category: [false, oneOf(SOCIAL_CATEGORIES)],
  special_category: [false, oneOf(SPECIAL_CATEGORIES)],
  annual_income: [false, money],
  education: [false, oneOf(EDUCATION_LEVELS)],
  experience_years: [false, intRange(0, 80)],
  is_new_enterprise: [false, bool],
  business_description: [false, text(1000)],
};

// ---------------------------------------------------------------- scheme discovery query
export const SCHEME_SORTS = ['name', 'investment', 'newest'];

const SCHEME_QUERY_FIELDS = {
  category: oneOf(BUSINESS_CATEGORIES.filter((c) => c !== 'any')),
  state: stateSlug,
  q: text(100),
  investment: money,
  sort: oneOf(SCHEME_SORTS),
  order: oneOf(['asc', 'desc']),
  page: intRange(1, 10000),
  limit: intRange(1, 50),
};

// Validates GET /api/schemes query params. Empty params are ignored; defaults applied.
// Returns { value, errors:[{field,message}] }.
export function validateSchemeQuery(query) {
  const src = query && typeof query === 'object' ? query : {};
  const value = { sort: 'name', order: 'asc', page: 1, limit: 12 };
  const errors = [];
  for (const [field, check] of Object.entries(SCHEME_QUERY_FIELDS)) {
    const raw = src[field];
    if (absent(raw)) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number') {
      errors.push({ field, message: `${field} is invalid` });
      continue;
    }
    const r = check(raw);
    if (r.error) errors.push({ field, message: `${field} ${r.error}` });
    else value[field] = r.value;
  }
  return { value, errors };
}

// Positive integer id from a route param, or null.
export function parseId(raw) {
  const n = Number(raw);
  return /^\d+$/.test(String(raw)) && Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}

// Validates a business profile. Absent optional fields become null.
// Returns { value, errors:[{field,message}] }. Unknown fields are ignored.
export function validateProfile(input, { requireCore = true } = {}) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const value = {};
  const errors = [];

  for (const [field, [isCore, check]] of Object.entries(PROFILE_FIELDS)) {
    const raw = src[field];
    if (absent(raw)) {
      if (isCore && requireCore) errors.push({ field, message: `${field} is required` });
      value[field] = null;
    } else if (typeof raw === 'object') {
      errors.push({ field, message: 'is invalid' });
    } else {
      const r = check(raw);
      if (r.error) errors.push({ field, message: `${field} ${r.error}` });
      else value[field] = r.value;
    }
  }
  return { value, errors };
}
