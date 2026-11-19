import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import Profile from '../models/profile.js';
import { authHeader, validProfile } from './helpers.js';

afterEach(() => jest.restoreAllMocks());

describe('/api/business-profile', () => {
  test('401 without token (GET and PUT)', async () => {
    expect((await request(app).get('/api/business-profile')).status).toBe(401);
    expect((await request(app).put('/api/business-profile').send(validProfile)).status).toBe(401);
  });

  test('GET returns null when nothing saved', async () => {
    jest.spyOn(Profile, 'findByUserId').mockResolvedValue(null);
    const res = await request(app).get('/api/business-profile').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { profile: null } });
  });

  test('GET looks up the profile of the calling user only', async () => {
    const spy = jest.spyOn(Profile, 'findByUserId').mockResolvedValue({ ...validProfile });
    const res = await request(app).get('/api/business-profile').set(authHeader(42));
    expect(spy).toHaveBeenCalledWith(42);
    expect(res.body.data.profile.state).toBe('tamil_nadu');
  });

  test('PUT validates and saves', async () => {
    const spy = jest.spyOn(Profile, 'upsert').mockImplementation(async (id, v) => v);
    const res = await request(app)
      .put('/api/business-profile')
      .set(authHeader(3))
      .send({ ...validProfile, investment: '250000', is_new_enterprise: 'true' });
    expect(res.status).toBe(200);
    expect(spy.mock.calls[0][0]).toBe(3);
    expect(res.body.data.profile).toMatchObject({ investment: 250000, is_new_enterprise: true, education: null });
  });

  test('PUT 400 lists every bad field and saves nothing', async () => {
    const spy = jest.spyOn(Profile, 'upsert');
    const res = await request(app)
      .put('/api/business-profile')
      .set(authHeader())
      .send({ age: 17, gender: 'robot', investment: -5 });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(['age', 'gender', 'business_category', 'investment', 'state']);
    expect(spy).not.toHaveBeenCalled();
  });
});
