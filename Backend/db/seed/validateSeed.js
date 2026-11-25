import { BUSINESS_CATEGORIES, STATES, GENDERS, SOCIAL_CATEGORIES, SPECIAL_CATEGORIES, EDUCATION_LEVELS, RELAXED_AGE_GROUPS, RULE_KEYS } from '../../utils/constants.js';

const enumChecks = {
  genders: GENDERS,
  states: STATES,
  business_categories: BUSINESS_CATEGORIES,
  social_categories: SOCIAL_CATEGORIES,
  special_categories: SPECIAL_CATEGORIES,
  relaxed_age_for: RELAXED_AGE_GROUPS,
};

// Returns a list of human-readable problems; empty list = valid.
export function validateSchemes(schemes) {
  const problems = [];
  const names = new Set();

  schemes.forEach((s, i) => {
    const label = `[${i}] ${s.name || '(no name)'}`;
    if (!s.name) problems.push(`${label}: missing name`);
    if (names.has(s.name)) problems.push(`${label}: duplicate name`);
    names.add(s.name);
    if (s.verified !== false) problems.push(`${label}: seed entries must have verified:false`);
    if (!s.official_source) problems.push(`${label}: missing official_source`);
    if (!BUSINESS_CATEGORIES.includes(s.business_category)) problems.push(`${label}: bad business_category "${s.business_category}"`);
    if (!STATES.includes(s.location)) problems.push(`${label}: bad location "${s.location}"`);
    if (!Array.isArray(s.beneficiary_categories)) problems.push(`${label}: beneficiary_categories must be an array`);
    else s.beneficiary_categories.forEach((c) => {
      if (!SPECIAL_CATEGORIES.includes(c)) problems.push(`${label}: unknown beneficiary category "${c}"`);
    });

    const rules = s.rules || {};
    for (const [key, value] of Object.entries(rules)) {
      const type = RULE_KEYS[key];
      if (!type) { problems.push(`${label}: unknown rule key "${key}"`); continue; }
      const actual = Array.isArray(value) ? 'array' : typeof value;
      if (actual !== type) problems.push(`${label}: rule "${key}" should be ${type}, got ${actual}`);
      if (enumChecks[key] && Array.isArray(value)) {
        value.forEach((v) => {
          if (!enumChecks[key].includes(v)) problems.push(`${label}: rule "${key}" has unknown value "${v}"`);
        });
      }
    }
    if (rules.min_education && !EDUCATION_LEVELS.includes(rules.min_education)) problems.push(`${label}: bad min_education "${rules.min_education}"`);
    if (rules.min_age !== undefined && rules.max_age !== undefined && rules.min_age > rules.max_age) problems.push(`${label}: min_age > max_age`);
    if (rules.min_project_cost !== undefined && rules.max_project_cost !== undefined && rules.min_project_cost > rules.max_project_cost) problems.push(`${label}: min_project_cost > max_project_cost`);
    if (rules.max_age_relaxed !== undefined && rules.max_age === undefined) problems.push(`${label}: max_age_relaxed without max_age`);
  });

  return problems;
}
