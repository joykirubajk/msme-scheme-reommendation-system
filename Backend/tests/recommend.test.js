import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import Scheme from '../models/scheme.js';
import Profile from '../models/profile.js';
import { authHeader, validProfile } from './helpers.js';

const schemes = [
  { id: 1, name: 'Open', business_category: 'any', rules: { min_age: 18 }, benefits: {}, beneficiary_categories: [] },
  { id: 2, name: 'Needs income', business_category: 'any', rules: { max_annual_income: 300000 }, benefits: {}, beneficiary_categories: [] },
  { id: 3, name: 'Seniors only', business_category: 'any', rules: { min_age: 60 }, benefits: {}, beneficiary_categories: [] },
];

let findAll, findProfile, upsert;
beforeEach(() => {
  findAll = jest.spyOn(Scheme, 'findAll').mockResolvedValue(schemes);
  findProfile = jest.spyOn(Profile, 'findByUserId').mockResolvedValue(null);
  upsert = jest.spyOn(Profile, 'upsert').mockResolvedValue({});
});
afterEach(() => jest.restoreAllMocks());

const post = (body, headers = authHeader()) => request(app).post('/api/schemes/recommend').set(headers).send(body);

describe('POST /api/schemes/recommend', () => {
  test('401 without a token', async () => {
    const res = await post({ profile: validProfile }, {});
    expect(res.status).toBe(401);
    expect(findAll).not.toHaveBeenCalled();
  });

  test('returns eligible then possibly eligible, hides not eligible, lists missing inputs', async () => {
    const res = await post({ profile: validProfile });
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.eligible_count).toBe(1);
    expect(res.body.possible_count).toBe(1);
    expect(res.body.data.map((s) => [s.id, s.tier])).toEqual([[1, 'eligible'], [2, 'possibly_eligible']]);
    expect(res.body.data[1].eligibility.missingInputs).toEqual(['income']);
    expect(upsert).not.toHaveBeenCalled();
  });

  test('400 with field errors for an invalid profile', async () => {
    const res = await post({ profile: { age: 30 } });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.map((e) => e.field)).toEqual(['gender', 'business_category', 'investment', 'state']);
    expect(findAll).not.toHaveBeenCalled();
  });

  test('non-numeric age -> 400', async () => {
    const res = await post({ profile: { ...validProfile, age: 'abc' } });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].field).toBe('age');
  });

  test('uses the saved profile when none is sent', async () => {
    findProfile.mockResolvedValue({ ...validProfile, annual_income: 100000 });
    const res = await post({});
    expect(res.status).toBe(200);
    expect(findProfile).toHaveBeenCalledWith(1);
    expect(res.body.data.map((s) => s.tier)).toEqual(['eligible', 'eligible']);
  });

  test('400 when no profile is sent and none is saved', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no saved profile/i);
  });

  test('save_profile:true stores the validated profile for this user', async () => {
    const res = await post({ profile: { ...validProfile, gender: ' Male ' }, save_profile: true }, authHeader(7));
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toBe(7);
    expect(upsert.mock.calls[0][1]).toMatchObject({ gender: 'male', age: 30, state: 'tamil_nadu', annual_income: null });
  });

  test('invalid profile is never saved', async () => {
    await post({ profile: { ...validProfile, age: 5 }, save_profile: true });
    expect(upsert).not.toHaveBeenCalled();
  });

  test('DB failure -> generic 500 JSON', async () => {
    findAll.mockRejectedValue(new Error('connection refused to 10.0.0.1'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await post({ profile: validProfile });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
    expect(log).toHaveBeenCalled();
  });
});
