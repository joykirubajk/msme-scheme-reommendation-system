import { validateProfile } from '../utils/validate.js';
import { validProfile } from './helpers.js';

const errs = (input, opts) => validateProfile(input, opts).errors.map((e) => e.field);

describe('validateProfile', () => {
  test('valid core profile; optional fields become null', () => {
    const { value, errors } = validateProfile(validProfile);
    expect(errors).toEqual([]);
    expect(value).toMatchObject({ ...validProfile, annual_income: null, education: null, is_new_enterprise: null });
  });

  test('coerces strings and normalises case / spacing', () => {
    const { value, errors } = validateProfile({
      ...validProfile, age: '25', gender: ' Female ', state: 'Tamil Nadu', investment: '0', education: 'Graduation',
    });
    expect(errors).toEqual([]);
    expect(value).toMatchObject({ age: 25, gender: 'female', state: 'tamil_nadu', investment: 0, education: 'graduation' });
  });

  test.each([[17], [101], [30.5], ['abc'], [true], [[30]], [{}]])('age %p rejected', (age) => {
    expect(errs({ ...validProfile, age })).toEqual(['age']);
  });

  test.each([[18], [100]])('age boundary %p accepted', (age) => {
    expect(errs({ ...validProfile, age })).toEqual([]);
  });

  test('investment: 0 ok, negative / NaN / huge rejected', () => {
    expect(errs({ ...validProfile, investment: 0 })).toEqual([]);
    expect(errs({ ...validProfile, investment: -1 })).toEqual(['investment']);
    expect(errs({ ...validProfile, investment: 'x' })).toEqual(['investment']);
    expect(errs({ ...validProfile, investment: 1e15 })).toEqual(['investment']);
  });

  test('enums, state and booleans', () => {
    expect(errs({ ...validProfile, social_category: 'alien' })).toEqual(['social_category']);
    expect(errs({ ...validProfile, special_category: 'pwd' })).toEqual([]);
    expect(errs({ ...validProfile, state: 'all_india' })).toEqual(['state']);
    expect(errs({ ...validProfile, state: "x'; DROP TABLE users;--" })).toEqual(['state']);
    expect(errs({ ...validProfile, is_new_enterprise: 'maybe' })).toEqual(['is_new_enterprise']);
    expect(validateProfile({ ...validProfile, is_new_enterprise: false }).value.is_new_enterprise).toBe(false);
  });

  test('description length limit', () => {
    expect(errs({ ...validProfile, business_description: 'a'.repeat(1001) })).toEqual(['business_description']);
    expect(errs({ ...validProfile, business_description: 'tailoring unit' })).toEqual([]);
  });

  test('missing core fields reported in order; requireCore:false skips them', () => {
    expect(errs({})).toEqual(['age', 'gender', 'business_category', 'investment', 'state']);
    expect(errs(null)).toHaveLength(5);
    expect(errs({}, { requireCore: false })).toEqual([]);
  });

  test('unknown fields are dropped', () => {
    expect(validateProfile({ ...validProfile, admin: true }).value.admin).toBeUndefined();
  });
});
