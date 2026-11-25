// Pure eligibility engine: no I/O, no DB. See docs/RULES_SCHEMA.md.
//
// evaluate(profile, scheme) -> { schemeId, tier, eligible, passedRules, failedRules, unknownRules, missingInputs }
//   tier: 'eligible'          every rule on the scheme is satisfied
//         'possibly_eligible' nothing failed, but >=1 rule could not be checked (user left a field empty)
//         'not_eligible'      >=1 rule failed
// Each rule entry: { rule, field, label, expected, actual, message }
import { EDUCATION_LEVELS, RELAXED_AGE_GROUPS, RULE_KEYS } from '../utils/constants.js';

export const REQUIRED_PROFILE_FIELDS = ['age', 'gender', 'business_category', 'investment', 'location'];

// ---------------------------------------------------------------- helpers
const num = (v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const slug = (v) =>
  typeof v === 'string' && v.trim() !== '' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : undefined;

const slugList = (v) => (Array.isArray(v) ? v.map(slug).filter(Boolean) : undefined);

const parseJson = (v, fallback) => {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return v ?? fallback;
};

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const minOf = (...vals) => { const v = vals.map(num).filter((x) => x !== undefined); return v.length ? Math.min(...v) : undefined; };
const maxOf = (...vals) => { const v = vals.map(num).filter((x) => x !== undefined); return v.length ? Math.max(...v) : undefined; };

const EDUCATION_ALIASES = { post_graduation: 'postgraduation', graduate: 'graduation', bachelors: 'graduation', masters: 'postgraduation' };

// ---------------------------------------------------------------- normalisers
// Accepts the form payload (location/income/experience) or stored profile (state/annual_income/experience_years).
export function normalizeProfile(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const education = slug(p.education);
  let isNew;
  if (typeof p.is_new_enterprise === 'boolean') isNew = p.is_new_enterprise;
  return {
    age: num(p.age),
    gender: slug(p.gender),
    social_category: slug(p.social_category),
    special_category: slug(p.special_category ?? p.beneficiary_category),
    business_category: slug(p.business_category),
    investment: num(p.investment),
    location: slug(p.location ?? p.state),
    income: num(p.income ?? p.annual_income),
    education: EDUCATION_ALIASES[education] || education,
    experience: num(p.experience ?? p.experience_years),
    previous_subsidy: num(p.previous_subsidy),
    business_description: typeof p.business_description === 'string' && p.business_description.trim() !== '' ? p.business_description.trim() : undefined,
    is_new_enterprise: isNew,
  };
}

export function missingRequiredFields(profile) {
  return REQUIRED_PROFILE_FIELDS.filter((f) => profile[f] === undefined);
}

// Maps new keys AND the legacy keys that may exist in a live database to one canonical rules object.
export function normalizeRules(scheme) {
  const raw = parseJson(scheme.rules, {}) || {};
  const r = {};

  for (const key of Object.keys(RULE_KEYS)) {
    if (raw[key] !== undefined && raw[key] !== null) r[key] = raw[key];
  }
  ['min_age', 'max_age', 'max_age_relaxed', 'min_project_cost'].forEach((k) => { if (r[k] !== undefined) r[k] = num(r[k]); });

  // legacy aliases
  const maxCost = minOf(raw.max_project_cost, raw.max_investment);
  if (maxCost !== undefined) r.max_project_cost = maxCost;
  const maxIncome = minOf(raw.max_annual_income, raw.max_income, raw.max_family_income);
  if (maxIncome !== undefined) r.max_annual_income = maxIncome;
  const minExp = maxOf(raw.min_experience_years, raw.min_experience);
  if (minExp !== undefined) r.min_experience_years = minExp;
  const maxSub = minOf(raw.max_previous_subsidy, raw.prior_subsidy_limit);
  if (maxSub !== undefined) r.max_previous_subsidy = maxSub;

  const states = Array.isArray(raw.states) ? raw.states : [raw.state, raw.domicile].filter((x) => typeof x === 'string');
  if (states.length) r.states = states;
  if (!r.genders && Array.isArray(raw.gender)) r.genders = raw.gender;

  const legacyGeneral = num(raw.max_age_general);
  const legacySpecial = num(raw.max_age_special);
  if (legacyGeneral !== undefined) r.max_age = minOf(r.max_age, legacyGeneral);
  if (legacySpecial !== undefined && r.max_age_relaxed === undefined) {
    r.max_age_relaxed = legacySpecial;
    if (!r.relaxed_age_for) r.relaxed_age_for = RELAXED_AGE_GROUPS;
  }

  for (const k of ['genders', 'states', 'business_categories', 'social_categories', 'special_categories', 'relaxed_age_for']) {
    if (r[k] !== undefined) r[k] = slugList(r[k]) || [];
  }
  if (r.min_education !== undefined) {
    const e = slug(r.min_education);
    r.min_education = EDUCATION_ALIASES[e] || e;
  }

  // The scheme's own business_category column acts as an implicit rule when no explicit list is given.
  const col = slug(scheme.business_category);
  if (!r.business_categories && col && col !== 'any') r.business_categories = [col];

  return r;
}

// Groups a user belongs to, used for age relaxation.
function userGroups(p) {
  const g = new Set();
  if (p.gender === 'female') g.add('women');
  if (p.gender === 'transgender') g.add('transgender');
  if (p.social_category === 'sc' || p.social_category === 'st') { g.add(p.social_category); g.add('sc_st'); }
  if (p.social_category === 'obc') g.add('obc');
  if (p.special_category) {
    g.add(p.special_category);
    if (p.special_category === 'bpl_women' || p.special_category === 'widow') g.add('women');
  }
  return g;
}

// ---------------------------------------------------------------- evaluation
export function evaluate(rawProfile, scheme) {
  const p = rawProfile && rawProfile.__normalized ? rawProfile : { ...normalizeProfile(rawProfile), __normalized: true };
  const r = normalizeRules(scheme);
  const passedRules = [];
  const failedRules = [];
  const unknownRules = [];

  const add = (list, rule, field, label, expected, actual, message) =>
    list.push({ rule, field, label, expected, actual: actual ?? null, message });
  const pass = (...a) => add(passedRules, ...a);
  const fail = (...a) => add(failedRules, ...a);
  const unknown = (rule, field, label, expected, message) => add(unknownRules, rule, field, label, expected, null, message);

  // numeric bound helper
  const bound = (rule, field, label, limit, actual, ok, fmt, okMsg, failMsg, unknownMsg) => {
    if (limit === undefined) return;
    if (actual === undefined) return unknown(rule, field, label, limit, unknownMsg);
    return ok ? pass(rule, field, label, limit, actual, okMsg) : fail(rule, field, label, limit, actual, failMsg);
  };

  // age
  bound('min_age', 'age', 'Minimum age', r.min_age, p.age, p.age >= r.min_age, null,
    `Age ${p.age} meets the minimum of ${r.min_age}`, `Age must be at least ${r.min_age} (you: ${p.age})`, 'Add your age to check the minimum age');

  if (r.max_age !== undefined || r.max_age_relaxed !== undefined) {
    const general = r.max_age;
    const relaxed = r.max_age_relaxed;
    const relaxedFor = r.relaxed_age_for && r.relaxed_age_for.length ? r.relaxed_age_for : (relaxed !== undefined ? RELAXED_AGE_GROUPS : []);
    if (p.age === undefined) {
      unknown('max_age', 'age', 'Maximum age', general ?? relaxed, 'Add your age to check the maximum age');
    } else {
      const groups = userGroups(p);
      const inGroup = relaxed !== undefined && relaxedFor.some((x) => groups.has(x));
      const categoryKnown = p.social_category !== undefined || p.special_category !== undefined;
      if (inGroup) {
        const limit = general !== undefined ? Math.max(general, relaxed) : relaxed;
        p.age <= limit
          ? pass('max_age', 'age', 'Maximum age', limit, p.age, `Age ${p.age} is within the relaxed limit of ${limit} for your category`)
          : fail('max_age', 'age', 'Maximum age', limit, p.age, `Age must be at most ${limit} (you: ${p.age})`);
      } else if (general === undefined) {
        // legacy "special only" limit: general applicants unrestricted
      } else if (p.age <= general) {
        pass('max_age', 'age', 'Maximum age', general, p.age, `Age ${p.age} is within the limit of ${general}`);
      } else if (relaxed !== undefined && p.age <= relaxed && !categoryKnown) {
        unknown('max_age', 'social_category', 'Maximum age', general, `Age limit is ${general}, relaxed to ${relaxed} for some categories - add your social/special category to check`);
      } else {
        fail('max_age', 'age', 'Maximum age', general, p.age, `Age must be at most ${general} (you: ${p.age})`);
      }
    }
  }

  // gender
  if (r.genders && r.genders.length) {
    p.gender === undefined
      ? unknown('genders', 'gender', 'Gender', r.genders, 'Add your gender to check this rule')
      : r.genders.includes(p.gender)
        ? pass('genders', 'gender', 'Gender', r.genders, p.gender, 'Gender requirement met')
        : fail('genders', 'gender', 'Gender', r.genders, p.gender, `Open to ${r.genders.join(' / ')} applicants only`);
  }

  // state / location
  if (r.states && r.states.length && !r.states.includes('all_india') && !r.states.includes('any')) {
    p.location === undefined
      ? unknown('states', 'location', 'State', r.states, 'Add your state to check this rule')
      : r.states.includes(p.location)
        ? pass('states', 'location', 'State', r.states, p.location, 'Available in your state')
        : fail('states', 'location', 'State', r.states, p.location, `Only for ${r.states.join(', ').replace(/_/g, ' ')}`);
  }

  // project cost / investment
  bound('min_project_cost', 'investment', 'Minimum project cost', r.min_project_cost, p.investment, p.investment >= r.min_project_cost, null,
    `Investment ${p.investment !== undefined ? inr(p.investment) : ''} meets the minimum of ${inr(r.min_project_cost ?? 0)}`,
    `Project cost must be at least ${inr(r.min_project_cost ?? 0)} (you: ${p.investment !== undefined ? inr(p.investment) : ''})`,
    'Add your investment amount to check this rule');
  bound('max_project_cost', 'investment', 'Maximum project cost', r.max_project_cost, p.investment, p.investment <= r.max_project_cost, null,
    `Investment ${p.investment !== undefined ? inr(p.investment) : ''} is within the limit of ${inr(r.max_project_cost ?? 0)}`,
    `Project cost must be at most ${inr(r.max_project_cost ?? 0)} (you: ${p.investment !== undefined ? inr(p.investment) : ''})`,
    'Add your investment amount to check this rule');

  // income
  bound('max_annual_income', 'income', 'Maximum annual income', r.max_annual_income, p.income, p.income <= r.max_annual_income, null,
    `Income is within the cap of ${inr(r.max_annual_income ?? 0)}`,
    `Annual income must be at most ${inr(r.max_annual_income ?? 0)} (you: ${p.income !== undefined ? inr(p.income) : ''})`,
    'Add your annual income to check this rule');

  // experience
  bound('min_experience_years', 'experience', 'Minimum experience', r.min_experience_years, p.experience, p.experience >= r.min_experience_years, null,
    `Experience of ${p.experience} years meets the minimum of ${r.min_experience_years}`,
    `Needs at least ${r.min_experience_years} years of experience (you: ${p.experience})`,
    'Add your business experience to check this rule');

  // education
  if (r.min_education !== undefined) {
    const need = EDUCATION_LEVELS.indexOf(r.min_education);
    const have = EDUCATION_LEVELS.indexOf(p.education);
    if (need === -1) {
      // unrecognised rule value: cannot evaluate, never silently pass
      unknown('min_education', 'education', 'Minimum education', r.min_education, 'Education requirement could not be checked');
    } else if (have === -1) {
      unknown('min_education', 'education', 'Minimum education', r.min_education, 'Add your education level to check this rule');
    } else if (have >= need) {
      pass('min_education', 'education', 'Minimum education', r.min_education, p.education, `Education (${p.education}) meets the minimum (${r.min_education})`);
    } else {
      fail('min_education', 'education', 'Minimum education', r.min_education, p.education, `Needs at least ${r.min_education} (you: ${p.education})`);
    }
  }

  // business category
  if (r.business_categories && r.business_categories.length && !r.business_categories.includes('any')) {
    (p.business_category === undefined || p.business_category === 'any')
      ? unknown('business_categories', 'business_category', 'Business type', r.business_categories, 'Select your specific business type to check this rule')
      : r.business_categories.includes(p.business_category)
        ? pass('business_categories', 'business_category', 'Business type', r.business_categories, p.business_category, 'Your business type is covered')
        : fail('business_categories', 'business_category', 'Business type', r.business_categories, p.business_category, `For ${r.business_categories.join(' / ')} businesses only`);
  }

  // social category
  if (r.social_categories && r.social_categories.length) {
    p.social_category === undefined
      ? unknown('social_categories', 'social_category', 'Social category', r.social_categories, 'Add your social category to check this rule')
      : r.social_categories.includes(p.social_category)
        ? pass('social_categories', 'social_category', 'Social category', r.social_categories, p.social_category, 'Your social category qualifies')
        : fail('social_categories', 'social_category', 'Social category', r.social_categories, p.social_category, `Only for ${r.social_categories.join(' / ').toUpperCase()} applicants`);
  }

  // special category (user qualifies if any of their categories is listed)
  if (r.special_categories && r.special_categories.length) {
    const mine = new Set();
    if (p.special_category) mine.add(p.special_category);
    if (p.social_category === 'sc' || p.social_category === 'st') mine.add('sc_st');
    if (p.gender === 'transgender') mine.add('transgender');
    const hit = r.special_categories.find((c) => mine.has(c));
    if (hit) {
      pass('special_categories', 'special_category', 'Special category', r.special_categories, hit, 'You belong to a priority category for this scheme');
    } else if (p.special_category === undefined && p.social_category === undefined) {
      unknown('special_categories', 'special_category', 'Special category', r.special_categories, 'Add your social/special category to check this rule');
    } else {
      fail('special_categories', 'special_category', 'Special category', r.special_categories, p.special_category ?? p.social_category, 'Only for specific priority categories');
    }
  }

  // previous subsidy
  bound('max_previous_subsidy', 'previous_subsidy', 'Previous subsidy limit', r.max_previous_subsidy, p.previous_subsidy, p.previous_subsidy <= r.max_previous_subsidy, null,
    'Previous subsidy is within the allowed limit', `Previous subsidy must be at most ${inr(r.max_previous_subsidy ?? 0)}`, 'Add any subsidy received earlier to check this rule');

  // new enterprise only
  if (r.is_new_enterprise_only === true) {
    p.is_new_enterprise === undefined
      ? unknown('is_new_enterprise_only', 'is_new_enterprise', 'New enterprise only', true, 'Tell us whether you are starting a new enterprise')
      : p.is_new_enterprise
        ? pass('is_new_enterprise_only', 'is_new_enterprise', 'New enterprise only', true, true, 'You are starting a new enterprise')
        : fail('is_new_enterprise_only', 'is_new_enterprise', 'New enterprise only', true, false, 'Only for new enterprises');
  }

  const tier = failedRules.length ? 'not_eligible' : unknownRules.length ? 'possibly_eligible' : 'eligible';
  const missingInputs = [...new Set(unknownRules.map((u) => u.field))];

  return { schemeId: scheme.id, tier, eligible: tier === 'eligible', passedRules, failedRules, unknownRules, missingInputs };
}

const TIER_ORDER = { eligible: 0, possibly_eligible: 1, not_eligible: 2 };

// Evaluates every scheme. not_eligible results are dropped unless includeNotEligible is set.
// Order: eligible first, then possibly_eligible, ties by scheme id (deterministic).
export function evaluateAll(rawProfile, schemes, { includeNotEligible = false } = {}) {
  const profile = { ...normalizeProfile(rawProfile), __normalized: true };
  return schemes
    .map((s) => evaluate(profile, s))
    .filter((r) => includeNotEligible || r.tier !== 'not_eligible')
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.schemeId - b.schemeId);
}
