// Independent reference implementation of the eligibility rules in docs/RULES_SCHEMA.md.
// Written separately from Backend/services/eligibilityEngine.js (it does NOT import it) so the
// evaluation can check the engine against a second reading of the same specification.
// It only understands the normalised rule keys used by the seed data (no legacy aliases).

const EDU = ['none', '8th', '10th', '12th', 'diploma', 'graduation', 'postgraduation'];

// Groups a person belongs to, for age relaxation and special-category rules.
function groupsOf(p) {
  const g = new Set();
  if (p.gender === 'female') g.add('women');
  if (p.gender === 'transgender') g.add('transgender');
  if (p.social_category === 'sc' || p.social_category === 'st') { g.add('sc_st'); g.add(p.social_category); }
  if (p.social_category === 'obc') g.add('obc');
  if (p.special_category) g.add(p.special_category);
  if (p.special_category === 'bpl_women' || p.special_category === 'widow') g.add('women');
  return g;
}

const has = (v) => v !== undefined && v !== null && v !== '';

// Returns 'eligible' | 'possibly_eligible' | 'not_eligible'.
// A rule FAILS if the person's value is known and violates it, is UNKNOWN if the value is missing.
export function referenceTier(p, scheme) {
  const r = scheme.rules || {};
  const g = groupsOf(p);
  let unknown = false;
  const check = (known, ok) => {
    if (!known) { unknown = true; return true; }
    return ok;
  };

  const results = [];
  if (r.min_age !== undefined) results.push(check(has(p.age), p.age >= r.min_age));

  if (r.max_age !== undefined) {
    const relaxedFor = r.relaxed_age_for || [];
    const inRelaxedGroup = r.max_age_relaxed !== undefined && relaxedFor.some((x) => g.has(x));
    const limit = inRelaxedGroup ? Math.max(r.max_age, r.max_age_relaxed) : r.max_age;
    if (!has(p.age)) {
      unknown = true;
    } else if (p.age > limit) {
      // Over the general limit but might qualify for relaxation if the category is unknown
      const categoryUnknown = !has(p.social_category) && !has(p.special_category);
      if (!inRelaxedGroup && r.max_age_relaxed !== undefined && p.age <= r.max_age_relaxed && categoryUnknown) unknown = true;
      else results.push(false);
    }
  }

  if (r.genders) results.push(check(has(p.gender), r.genders.includes(p.gender)));
  if (r.states && !r.states.includes('all_india')) results.push(check(has(p.state), r.states.includes(p.state)));
  if (r.min_project_cost !== undefined) results.push(check(has(p.investment), p.investment >= r.min_project_cost));
  if (r.max_project_cost !== undefined) results.push(check(has(p.investment), p.investment <= r.max_project_cost));
  if (r.max_annual_income !== undefined) results.push(check(has(p.annual_income), p.annual_income <= r.max_annual_income));
  if (r.min_experience_years !== undefined) results.push(check(has(p.experience_years), p.experience_years >= r.min_experience_years));
  if (r.min_education !== undefined) results.push(check(has(p.education), EDU.indexOf(p.education) >= EDU.indexOf(r.min_education)));

  // Explicit business_categories rule, else the scheme's own column (unless "any") - see RULES_SCHEMA.md
  const cats = r.business_categories || (scheme.business_category && scheme.business_category !== 'any' ? [scheme.business_category] : null);
  if (cats) results.push(check(has(p.business_category), cats.includes(p.business_category)));

  if (r.social_categories) results.push(check(has(p.social_category), r.social_categories.includes(p.social_category)));
  if (r.special_categories) {
    const known = has(p.social_category) || has(p.special_category);
    const member = r.special_categories.some((c) => g.has(c));
    if (!member) results.push(check(known, false));
  }
  // previous subsidy is not collected by the form, so this is always unknown when present
  if (r.max_previous_subsidy !== undefined) results.push(check(has(p.previous_subsidy), p.previous_subsidy <= r.max_previous_subsidy));
  if (r.is_new_enterprise_only) results.push(check(typeof p.is_new_enterprise === 'boolean', p.is_new_enterprise === true));

  if (results.includes(false)) return 'not_eligible';
  return unknown ? 'possibly_eligible' : 'eligible';
}
