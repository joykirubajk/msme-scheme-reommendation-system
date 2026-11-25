import fs from 'fs';
import { validateSchemes } from '../db/seed/validateSeed.js';

const seed = JSON.parse(fs.readFileSync(new URL('../db/seed/schemes.data.json', import.meta.url), 'utf8'));

describe('seed data', () => {
  test('has between 15 and 30 schemes', () => {
    expect(seed.length).toBeGreaterThanOrEqual(15);
    expect(seed.length).toBeLessThanOrEqual(30);
  });

  test('passes rules-vocabulary validation', () => {
    expect(validateSchemes(seed)).toEqual([]);
  });

  test('every entry is flagged unverified with an official_source', () => {
    seed.forEach((s) => {
      expect(s.verified).toBe(false);
      expect(typeof s.official_source).toBe('string');
    });
  });

  test('validator catches legacy / unknown keys and bad values', () => {
    const bad = [{
      name: 'X', verified: false, official_source: 'x', business_category: 'any', location: 'all_india',
      beneficiary_categories: [], rules: { max_investment: 5, states: ['atlantis'], min_age: 40, max_age: 30 },
    }];
    const problems = validateSchemes(bad).join('\n');
    expect(problems).toMatch(/unknown rule key "max_investment"/);
    expect(problems).toMatch(/unknown value "atlantis"/);
    expect(problems).toMatch(/min_age > max_age/);
  });
});
