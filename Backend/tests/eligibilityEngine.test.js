import { evaluate, evaluateAll, normalizeProfile, normalizeRules, missingRequiredFields } from '../services/eligibilityEngine.js';

// A complete, ordinary profile; tests override single fields.
const base = {
  age: 30, gender: 'male', business_category: 'manufacturing', investment: 500000, location: 'tamil_nadu',
  social_category: 'general', special_category: null, income: 200000, education: 'graduation', experience: 3,
};
const scheme = (rules = {}, extra = {}) => ({ id: 1, name: 'S', business_category: 'any', rules, beneficiary_categories: [], ...extra });
const tier = (profile, rules, extra) => evaluate({ ...base, ...profile }, scheme(rules, extra)).tier;

describe('tiers', () => {
  test('scheme with no rules is eligible', () => {
    const r = evaluate(base, scheme({}));
    expect(r).toMatchObject({ tier: 'eligible', eligible: true, failedRules: [], unknownRules: [], passedRules: [] });
  });

  test('one failed rule -> not_eligible even if others unknown', () => {
    expect(tier({ income: undefined, age: 10 }, { min_age: 18, max_annual_income: 1 })).toBe('not_eligible');
  });

  test('unknown but nothing failed -> possibly_eligible with missingInputs', () => {
    const r = evaluate({ ...base, income: null }, scheme({ max_annual_income: 300000 }));
    expect(r.tier).toBe('possibly_eligible');
    expect(r.eligible).toBe(false);
    expect(r.missingInputs).toEqual(['income']);
    expect(r.unknownRules[0].rule).toBe('max_annual_income');
  });

  test('passed rules carry rule, label and message', () => {
    const r = evaluate(base, scheme({ min_age: 18 }));
    expect(r.passedRules).toHaveLength(1);
    expect(r.passedRules[0]).toMatchObject({ rule: 'min_age', field: 'age', expected: 18, actual: 30 });
    expect(r.passedRules[0].message).toMatch(/Age 30/);
  });
});

describe('age boundaries', () => {
  test.each([
    [17, 'not_eligible'], [18, 'eligible'], [19, 'eligible'],
  ])('min_age 18, age %i -> %s', (age, expected) => {
    expect(tier({ age }, { min_age: 18 })).toBe(expected);
  });

  test.each([
    [44, 'eligible'], [45, 'eligible'], [46, 'not_eligible'],
  ])('max_age 45, age %i -> %s', (age, expected) => {
    expect(tier({ age }, { max_age: 45 })).toBe(expected);
  });

  test('missing age -> possibly_eligible, not a silent pass (old bug)', () => {
    expect(tier({ age: undefined }, { min_age: 18 })).toBe('possibly_eligible');
    expect(tier({ age: 'abc' }, { min_age: 18 })).toBe('possibly_eligible');
  });
});

describe('age relaxation for special categories', () => {
  const rules = { max_age: 35, max_age_relaxed: 45, relaxed_age_for: ['women', 'sc_st'] };

  test('general male aged 40 with category known -> not eligible', () => {
    expect(tier({ age: 40, gender: 'male', social_category: 'general' }, rules)).toBe('not_eligible');
  });
  test('woman aged 40 -> eligible (relaxed)', () => {
    expect(tier({ age: 40, gender: 'female' }, rules)).toBe('eligible');
  });
  test('woman aged 46 -> not eligible (beyond relaxed limit)', () => {
    expect(tier({ age: 46, gender: 'female' }, rules)).toBe('not_eligible');
  });
  test('SC male aged 45 -> eligible; aged 46 -> not', () => {
    expect(tier({ age: 45, social_category: 'sc' }, rules)).toBe('eligible');
    expect(tier({ age: 46, social_category: 'sc' }, rules)).toBe('not_eligible');
  });
  test('man aged 40, category not given -> possibly eligible asking for category', () => {
    const r = evaluate({ ...base, age: 40, social_category: null }, scheme(rules));
    expect(r.tier).toBe('possibly_eligible');
    expect(r.missingInputs).toEqual(['social_category']);
  });
  test('age within general limit passes regardless of category', () => {
    expect(tier({ age: 35, social_category: null }, rules)).toBe('eligible');
  });
});

describe('gender', () => {
  test('female-only scheme', () => {
    expect(tier({ gender: 'female' }, { genders: ['female'] })).toBe('eligible');
    expect(tier({ gender: 'male' }, { genders: ['female'] })).toBe('not_eligible');
    expect(tier({ gender: 'Female ' }, { genders: ['female'] })).toBe('eligible');
    expect(tier({ gender: null }, { genders: ['female'] })).toBe('possibly_eligible');
  });
});

describe('location / All India', () => {
  test.each([
    ['tamil_nadu', ['tamil_nadu'], 'eligible'],
    ['Tamil Nadu', ['tamil_nadu'], 'eligible'],
    ['karnataka', ['tamil_nadu'], 'not_eligible'],
    ['other', ['tamil_nadu'], 'not_eligible'],
    ['karnataka', ['all_india'], 'eligible'],
    ['karnataka', [], 'eligible'],
    [null, ['tamil_nadu'], 'possibly_eligible'],
    [null, ['all_india'], 'eligible'],
  ])('user %p vs states %p -> %s', (location, states, expected) => {
    expect(tier({ location }, { states })).toBe(expected);
  });
});

describe('project cost / investment', () => {
  test.each([
    [0, 'not_eligible'], [49999, 'not_eligible'], [50000, 'eligible'], [100000, 'eligible'], [100001, 'not_eligible'],
  ])('range 50000..100000, investment %i -> %s', (investment, expected) => {
    expect(tier({ investment }, { min_project_cost: 50000, max_project_cost: 100000 })).toBe(expected);
  });

  test('investment 0 is a real value (old truthiness bug)', () => {
    expect(tier({ investment: 0 }, { min_project_cost: 1000 })).toBe('not_eligible');
    expect(tier({ investment: 0 }, { max_project_cost: 1000 })).toBe('eligible');
  });

  test('investment missing -> possibly eligible', () => {
    expect(tier({ investment: null }, { max_project_cost: 1000 })).toBe('possibly_eligible');
  });
});

describe('income, experience, previous subsidy', () => {
  test('income cap boundary', () => {
    expect(tier({ income: 300000 }, { max_annual_income: 300000 })).toBe('eligible');
    expect(tier({ income: 300001 }, { max_annual_income: 300000 })).toBe('not_eligible');
    expect(tier({ income: 0 }, { max_annual_income: 300000 })).toBe('eligible');
  });
  test('experience 0 is a real value; missing is unknown', () => {
    expect(tier({ experience: 0 }, { min_experience_years: 1 })).toBe('not_eligible');
    expect(tier({ experience: 1 }, { min_experience_years: 1 })).toBe('eligible');
    expect(tier({ experience: null }, { min_experience_years: 1 })).toBe('possibly_eligible');
  });
  test('previous subsidy limit', () => {
    expect(tier({ previous_subsidy: 0 }, { max_previous_subsidy: 100 })).toBe('eligible');
    expect(tier({ previous_subsidy: 101 }, { max_previous_subsidy: 100 })).toBe('not_eligible');
    expect(tier({}, { max_previous_subsidy: 100 })).toBe('possibly_eligible');
  });
});

describe('education (old code never compared it)', () => {
  test.each([
    ['10th', '8th', 'eligible'], ['8th', '10th', 'not_eligible'], ['graduation', 'graduation', 'eligible'],
    ['postgraduation', 'graduation', 'eligible'], ['diploma', 'graduation', 'not_eligible'], [null, '10th', 'possibly_eligible'],
    ['Post Graduation', 'graduation', 'eligible'],
  ])('user %p vs min %p -> %s', (education, min_education, expected) => {
    expect(tier({ education }, { min_education })).toBe(expected);
  });
  test('unrecognised rule value is unknown, never a silent pass', () => {
    expect(tier({ education: '10th' }, { min_education: 'phd-ish' })).toBe('possibly_eligible');
  });
});

describe('business category (old code never compared it)', () => {
  test('explicit list', () => {
    expect(tier({ business_category: 'trading' }, { business_categories: ['manufacturing', 'service'] })).toBe('not_eligible');
    expect(tier({ business_category: 'service' }, { business_categories: ['manufacturing', 'service'] })).toBe('eligible');
  });
  test('user chose "any" -> unknown', () => {
    expect(tier({ business_category: 'any' }, { business_categories: ['manufacturing'] })).toBe('possibly_eligible');
  });
  test('scheme column acts as implicit rule', () => {
    expect(tier({ business_category: 'retail' }, {}, { business_category: 'agriculture' })).toBe('not_eligible');
    expect(tier({ business_category: 'agriculture' }, {}, { business_category: 'agriculture' })).toBe('eligible');
    expect(tier({ business_category: 'retail' }, {}, { business_category: 'any' })).toBe('eligible');
  });
  test('list containing "any" is unrestricted', () => {
    expect(tier({ business_category: 'retail' }, { business_categories: ['any'] })).toBe('eligible');
  });
});

describe('social and special categories', () => {
  test('social category rule', () => {
    expect(tier({ social_category: 'sc' }, { social_categories: ['sc', 'st'] })).toBe('eligible');
    expect(tier({ social_category: 'general' }, { social_categories: ['sc', 'st'] })).toBe('not_eligible');
    expect(tier({ social_category: null }, { social_categories: ['sc', 'st'] })).toBe('possibly_eligible');
  });
  test('special category matched directly or derived from social category', () => {
    expect(tier({ special_category: 'pwd' }, { special_categories: ['pwd', 'widow'] })).toBe('eligible');
    expect(tier({ social_category: 'st', special_category: null }, { special_categories: ['sc_st'] })).toBe('eligible');
    expect(tier({ gender: 'transgender', social_category: 'general' }, { special_categories: ['transgender'] })).toBe('eligible');
  });
  test('special category not matched: fail if user gave category info, unknown if not', () => {
    expect(tier({ social_category: 'general', special_category: null }, { special_categories: ['pwd'] })).toBe('not_eligible');
    expect(tier({ social_category: null, special_category: null }, { special_categories: ['pwd'] })).toBe('possibly_eligible');
  });
  test('form field beneficiary_category is read as special category', () => {
    expect(tier({ special_category: undefined, beneficiary_category: 'widow' }, { special_categories: ['widow'] })).toBe('eligible');
  });
});

describe('new enterprise only', () => {
  test('unknown / true / false', () => {
    expect(tier({}, { is_new_enterprise_only: true })).toBe('possibly_eligible');
    expect(tier({ is_new_enterprise: true }, { is_new_enterprise_only: true })).toBe('eligible');
    expect(tier({ is_new_enterprise: false }, { is_new_enterprise_only: true })).toBe('not_eligible');
    expect(tier({}, { is_new_enterprise_only: false })).toBe('eligible');
  });
});

describe('regression: old dangling-if bug in checkEligibility', () => {
  test('education AND previous-subsidy checks both apply independently', () => {
    // old code: the subsidy check only ran when min_education && user.education held
    const rules = { max_previous_subsidy: 100 };
    expect(tier({ education: undefined, previous_subsidy: 500 }, rules)).toBe('not_eligible');
  });
});

describe('legacy rule keys (existing DB rows)', () => {
  test.each([
    [{ max_investment: 1000 }, { investment: 2000 }, 'not_eligible'],
    [{ max_project_cost: 1000 }, { investment: 500 }, 'eligible'],
    [{ state: 'Tamil Nadu' }, { location: 'karnataka' }, 'not_eligible'],
    [{ domicile: 'tamil_nadu' }, { location: 'tamil_nadu' }, 'eligible'],
    [{ max_income: 100 }, { income: 200 }, 'not_eligible'],
    [{ max_family_income: 100 }, { income: 200 }, 'not_eligible'],
    [{ min_experience: 2 }, { experience: 1 }, 'not_eligible'],
    [{ prior_subsidy_limit: 10 }, { previous_subsidy: 20 }, 'not_eligible'],
    [{ gender: ['female'] }, { gender: 'male' }, 'not_eligible'],
  ])('rules %j / profile %j -> %s', (rules, profile, expected) => {
    expect(tier(profile, rules)).toBe(expected);
  });

  test('max_age_special / max_age_general', () => {
    const rules = { max_age_general: 35, max_age_special: 45 };
    expect(tier({ age: 40, social_category: 'sc' }, rules)).toBe('eligible');
    expect(tier({ age: 40, social_category: 'general' }, rules)).toBe('not_eligible');
    expect(tier({ age: 36, social_category: 'general' }, rules)).toBe('not_eligible');
  });

  test('rules and beneficiary_categories may arrive as JSON strings / objects', () => {
    const s = { id: 2, rules: '{"min_age":18}', beneficiary_categories: '{"sc_st":true}', business_category: 'any' };
    expect(evaluate({ ...base, age: 17 }, s).tier).toBe('not_eligible');
    expect(evaluate({ ...base, age: 18 }, s).tier).toBe('eligible');
    expect(evaluate(base, { id: 3, rules: 'not json{' }).tier).toBe('eligible');
    expect(evaluate(base, { id: 4, rules: null }).tier).toBe('eligible');
  });
});

describe('normalisers', () => {
  test('normalizeProfile accepts form and stored-profile names and blanks', () => {
    expect(normalizeProfile({ age: '32', state: 'Tamil Nadu', annual_income: '', experience_years: '0', beneficiary_category: 'pwd' }))
      .toMatchObject({ age: 32, location: 'tamil_nadu', income: undefined, experience: 0, special_category: 'pwd' });
    expect(normalizeProfile(null).age).toBeUndefined();
    expect(normalizeProfile({ age: NaN }).age).toBeUndefined();
  });
  test('missingRequiredFields', () => {
    expect(missingRequiredFields(normalizeProfile({ age: 30, gender: 'male' }))).toEqual(['business_category', 'investment', 'location']);
    expect(missingRequiredFields(normalizeProfile({ ...base, investment: 0 }))).toEqual([]);
  });
  test('normalizeRules merges legacy aliases using the strictest value', () => {
    expect(normalizeRules({ rules: { max_investment: 10, max_project_cost: 5 } }).max_project_cost).toBe(5);
  });
});

describe('evaluateAll', () => {
  const schemes = [
    scheme({ min_age: 60 }, { id: 5 }),
    scheme({ max_annual_income: 1 }, { id: 4 }),
    scheme({}, { id: 3 }),
    scheme({}, { id: 1 }),
  ];
  test('drops not_eligible, orders eligible before possibly, then by id', () => {
    const out = evaluateAll({ ...base, income: null }, schemes);
    expect(out.map((r) => [r.schemeId, r.tier])).toEqual([[1, 'eligible'], [3, 'eligible'], [4, 'possibly_eligible']]);
  });
  test('includeNotEligible keeps everything and is deterministic', () => {
    const a = evaluateAll(base, schemes, { includeNotEligible: true });
    const b = evaluateAll(base, schemes, { includeNotEligible: true });
    expect(a).toEqual(b);
    expect(a.map((r) => r.schemeId)).toEqual([1, 3, 4, 5]);
  });
  test('does not mutate inputs', () => {
    const p = { ...base };
    const s = JSON.parse(JSON.stringify(schemes));
    evaluateAll(p, schemes);
    expect(p).toEqual(base);
    expect(schemes).toEqual(s);
  });
});

describe('seed schemes work end-to-end with the engine', () => {
  test('a fully specified woman entrepreneur in Tamil Nadu gets TN schemes; a Delhi user does not', async () => {
    const fs = await import('fs');
    const seed = JSON.parse(fs.readFileSync(new URL('../db/seed/schemes.data.json', import.meta.url), 'utf8'))
      .map((s, i) => ({ ...s, id: i + 1 }));
    const tn = evaluateAll({ ...base, gender: 'female', age: 30, location: 'tamil_nadu', is_new_enterprise: true }, seed);
    const delhi = evaluateAll({ ...base, gender: 'female', age: 30, location: 'delhi', is_new_enterprise: true }, seed);
    const names = (r) => r.map((x) => seed.find((s) => s.id === x.schemeId).name);
    expect(names(tn).some((n) => n.includes('Tamil Nadu UYEGP'))).toBe(true);
    expect(names(delhi).some((n) => n.includes('Tamil Nadu'))).toBe(false);
    expect(names(delhi).some((n) => n.includes('Uttar Pradesh'))).toBe(false);
  });
});
