import { jest } from '@jest/globals';
import fs from 'fs';
import request from 'supertest';
import app from '../app.js';
import Scheme from '../models/scheme.js';
import { scoreScheme, combine } from '../services/fallbackScorer.js';
import { rankWithService, validateRankResponse } from '../services/rankingClient.js';
import { recommend, toRankingScheme } from '../services/recommendationService.js';
import { normalizeProfile } from '../services/eligibilityEngine.js';
import { authHeader, validProfile } from './helpers.js';

const parity = JSON.parse(fs.readFileSync(new URL('../../ranking-service/tests/fixtures/parity.json', import.meta.url), 'utf8'));

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.RANKING_SERVICE_URL;
});

describe('fallbackScorer matches the Python scorer (parity fixture)', () => {
  test('fixture has cases', () => expect(parity.length).toBeGreaterThanOrEqual(15));

  test.each(parity.map((c) => [c.name, c]))('%s', (name, c) => {
    const { score, reasons } = scoreScheme(c.profile, c.scheme);
    expect(score).toBeCloseTo(c.expected_score, 5);
    expect(reasons.length).toBeGreaterThan(0);
  });

  test('combine drops missing signals and renormalises', () => {
    expect(combine({ text: null, investment: null, benefit: 0.8, specificity: null, age: null }, 'eligible')).toBeCloseTo(0.8);
    expect(combine({}, 'eligible')).toBe(0);
    expect(combine({ benefit: 1 }, 'possibly_eligible')).toBeCloseTo(0.9);
  });
});

describe('rankingClient', () => {
  const payload = { profile: {}, schemes: [{ id: 1 }, { id: 2 }] };
  const good = { model_version: 'abc12345', results: [{ scheme_id: 1, score: 0.5, reasons: ['a'] }, { scheme_id: 2, score: 0.4, reasons: [] }] };
  const fetchOk = (body, status = 200) => jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

  test('returns the body on success and posts to /rank', async () => {
    const f = fetchOk(good);
    const out = await rankWithService(payload, { url: 'http://x:8001/', fetchImpl: f });
    expect(out).toEqual(good);
    expect(f.mock.calls[0][0]).toBe('http://x:8001/rank');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(payload);
  });

  test('throws when URL not configured', async () => {
    await expect(rankWithService(payload, { url: undefined, fetchImpl: fetchOk(good) })).rejects.toThrow(/not set/);
  });

  test('throws on non-200', async () => {
    await expect(rankWithService(payload, { url: 'http://x', fetchImpl: fetchOk({}, 500) })).rejects.toThrow(/500/);
  });

  test('aborts after the timeout', async () => {
    const hang = jest.fn((url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const started = Date.now();
    await expect(rankWithService(payload, { url: 'http://x', timeoutMs: 50, fetchImpl: hang })).rejects.toThrow(/aborted/);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test.each([
    ['not an object', null],
    ['missing results', { model_version: 'v' }],
    ['score above 1', { model_version: 'v', results: [{ scheme_id: 1, score: 1.5, reasons: [] }, { scheme_id: 2, score: 0, reasons: [] }] }],
    ['NaN score', { model_version: 'v', results: [{ scheme_id: 1, score: NaN, reasons: [] }, { scheme_id: 2, score: 0, reasons: [] }] }],
    ['missing a scheme', { model_version: 'v', results: [{ scheme_id: 1, score: 0.1, reasons: [] }] }],
    ['duplicate scheme', { model_version: 'v', results: [{ scheme_id: 1, score: 0.1, reasons: [] }, { scheme_id: 1, score: 0.1, reasons: [] }] }],
    ['reasons not strings', { model_version: 'v', results: [{ scheme_id: 1, score: 0.1, reasons: [1] }, { scheme_id: 2, score: 0, reasons: [] }] }],
  ])('rejects malformed response: %s', (name, body) => {
    expect(() => validateRankResponse(body, [1, 2])).toThrow();
  });
});

describe('recommendationService', () => {
  const schemes = [
    { id: 1, name: 'Low', business_category: 'any', rules: { min_age: 18 }, benefits: { subsidy_percent: 5 }, beneficiary_categories: [] },
    { id: 2, name: 'High', business_category: 'any', rules: { min_age: 18 }, benefits: { subsidy_percent: 35, max_subsidy: 1750000 }, beneficiary_categories: [] },
    { id: 3, name: 'Out', business_category: 'any', rules: { min_age: 99 }, benefits: {}, beneficiary_categories: [] },
  ];
  const profile = normalizeProfile(validProfile);
  const mute = () => jest.spyOn(console, 'warn').mockImplementation(() => {});

  test('uses service scores when available (ranked_by ml) and only sends eligible schemes', async () => {
    const rank = jest.fn(async ({ schemes: sent }) => ({
      model_version: 'v1',
      results: sent.map((s) => ({ scheme_id: s.id, score: s.id === 1 ? 0.9 : 0.2, reasons: [`r${s.id}`] })),
    }));
    const out = await recommend(profile, schemes, { rank });
    expect(out.ranked_by).toBe('ml');
    expect(out.model_version).toBe('v1');
    expect(out.results.map((r) => r.schemeId)).toEqual([1, 2]);
    expect(rank.mock.calls[0][0].schemes.map((s) => s.id)).toEqual([1, 2]);
    expect(rank.mock.calls[0][0].schemes[0].tier).toBe('eligible');
  });

  test('falls back to the deterministic scorer when the service throws', async () => {
    mute();
    const out = await recommend(profile, schemes, { rank: async () => { throw new Error('down'); } });
    expect(out.ranked_by).toBe('fallback');
    expect(out.model_version).toBeNull();
    expect(out.results.map((r) => r.schemeId)).toEqual([2, 1]); // bigger benefit first
    expect(out.results[0].score).toBeGreaterThan(out.results[1].score);
    expect(out.results[0].reasons.length).toBeGreaterThan(0);
  });

  test('fallback is deterministic', async () => {
    mute();
    const down = async () => { throw new Error('down'); };
    expect(await recommend(profile, schemes, { rank: down })).toEqual(await recommend(profile, schemes, { rank: down }));
  });

  test('no eligible schemes -> no ranking call', async () => {
    const rank = jest.fn();
    const out = await recommend(profile, [schemes[2]], { rank });
    expect(out).toEqual({ ranked_by: 'none', model_version: null, results: [] });
    expect(rank).not.toHaveBeenCalled();
  });

  test('toRankingScheme sends canonical rules and array categories', () => {
    const s = toRankingScheme({ id: 9, rules: '{"max_investment": 5, "state": "Tamil Nadu"}', beneficiary_categories: { sc_st: true }, benefits: '{"subsidy_percent": 10}', max_investment: '2500.00' }, 'eligible');
    expect(s.rules).toMatchObject({ max_project_cost: 5, states: ['tamil_nadu'] });
    expect(s.beneficiary_categories).toEqual(['sc_st']);
    expect(s.benefits).toEqual({ subsidy_percent: 10 });
    expect(s.max_investment).toBe(2500);
  });
});

describe('POST /api/schemes/recommend with ranking', () => {
  const schemes = [
    { id: 1, name: 'A', business_category: 'any', rules: { min_age: 18 }, benefits: {}, beneficiary_categories: [] },
    { id: 2, name: 'B', business_category: 'any', rules: { min_age: 18 }, benefits: { subsidy_percent: 30 }, beneficiary_categories: [] },
  ];
  const post = () => request(app).post('/api/schemes/recommend').set(authHeader()).send({ profile: validProfile });

  test('service not configured -> ranked_by fallback, still 200', async () => {
    jest.spyOn(Scheme, 'findAll').mockResolvedValue(schemes);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body.ranked_by).toBe('fallback');
    expect(res.body.data.map((s) => s.id)).toEqual([2, 1]);
    expect(res.body.data[0]).toMatchObject({ tier: 'eligible', score: expect.any(Number), reasons: expect.any(Array) });
  });

  test('service up -> ranked_by ml with model_version and service order', async () => {
    process.env.RANKING_SERVICE_URL = 'http://ranking.test';
    jest.spyOn(Scheme, 'findAll').mockResolvedValue(schemes);
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ model_version: 'abc12345', results: [{ scheme_id: 1, score: 0.8, reasons: ['ml says A'] }, { scheme_id: 2, score: 0.1, reasons: [] }] }),
    });
    const res = await post();
    expect(res.body.ranked_by).toBe('ml');
    expect(res.body.model_version).toBe('abc12345');
    expect(res.body.data.map((s) => s.id)).toEqual([1, 2]);
    expect(res.body.data[0].reasons).toEqual(['ml says A']);
  });

  test('service returns garbage -> falls back instead of failing', async () => {
    process.env.RANKING_SERVICE_URL = 'http://ranking.test';
    jest.spyOn(Scheme, 'findAll').mockResolvedValue(schemes);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ nope: true }) });
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body.ranked_by).toBe('fallback');
  });

  test('service connection refused -> falls back', async () => {
    process.env.RANKING_SERVICE_URL = 'http://ranking.test';
    jest.spyOn(Scheme, 'findAll').mockResolvedValue(schemes);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const res = await post();
    expect(res.status).toBe(200);
    expect(res.body.ranked_by).toBe('fallback');
  });
});
