import { labelFor, formatRupees, normalizeScheme, officialUrl, errorMessage } from '../utils/format';

test.each([
  ['tamil_nadu', 'Tamil Nadu'],
  ['all_india', 'All India'],
  ['sc_st', 'SC/ST'],
  ['manufacturing', 'Manufacturing'],
  ['', ''],
  [null, ''],
])('labelFor(%p) = %p', (slug, label) => expect(labelFor(slug)).toBe(label));

test.each([
  [50000, '₹50,000'],
  [250000, '₹2.5 lakh'],
  ['1000000', '₹10 lakh'],
  [15000000, '₹1.5 crore'],
  [null, 'N/A'],
  ['abc', 'N/A'],
])('formatRupees(%p) = %p', (n, s) => expect(formatRupees(n)).toBe(s));

test('normalizeScheme parses JSON strings and object-shaped beneficiary categories', () => {
  const s = normalizeScheme({
    id: 1, rules: '{"min_age":18}', benefits: '{"max_subsidy":5}',
    beneficiary_categories: { sc_st: 'SC/ST', pwd: 'PwD' },
  });
  expect(s.rules).toEqual({ min_age: 18 });
  expect(s.benefits).toEqual({ max_subsidy: 5 });
  expect(s.beneficiary_categories).toEqual(['sc_st', 'pwd']);
  expect(normalizeScheme({ rules: 'not json' }).rules).toEqual({});
});

test('officialUrl pulls the first link out of a source note', () => {
  expect(officialUrl('https://msmeonline.tn.gov.in (confirm exact page)')).toBe('https://msmeonline.tn.gov.in');
  expect(officialUrl('see lead bank portal')).toBeNull();
  expect(officialUrl(null)).toBeNull();
});

test('errorMessage prefers the server message and explains network failures', () => {
  expect(errorMessage({ response: { data: { message: 'Nope' } } })).toBe('Nope');
  expect(errorMessage({ request: {} })).toMatch(/Cannot reach the server/);
  expect(errorMessage({}, 'fallback')).toBe('fallback');
});
