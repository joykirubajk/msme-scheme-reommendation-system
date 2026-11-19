// Scheme discovery: GET /api/schemes, /api/schemes/filters, /api/schemes/:id
// Route-level tests with the model mocked (no DB needed).
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../app.js';
import Scheme from '../models/scheme.js';
import { validateSchemeQuery, parseId } from '../utils/validate.js';

afterEach(() => jest.restoreAllMocks());

describe('validateSchemeQuery', () => {
  test('applies defaults when empty', () => {
    expect(validateSchemeQuery({})).toEqual({
      value: { sort: 'name', order: 'asc', page: 1, limit: 12 },
      errors: [],
    });
  });

  test('accepts and normalises valid params', () => {
    const { value, errors } = validateSchemeQuery({
      category: 'Manufacturing', state: 'Tamil Nadu', q: ' loan ', investment: '500000',
      sort: 'investment', order: 'DESC', page: '2', limit: '5',
    });
    expect(errors).toEqual([]);
    expect(value).toEqual({
      category: 'manufacturing', state: 'tamil_nadu', q: 'loan', investment: 500000,
      sort: 'investment', order: 'desc', page: 2, limit: 5,
    });
  });

  test.each([
    ['category', 'any'], ['category', 'spaceships'], ['sort', 'rules; DROP TABLE schemes'],
    ['order', 'sideways'], ['page', '0'], ['page', '1.5'], ['limit', '51'], ['limit', '-1'],
    ['investment', '-5'], ['investment', 'lots'], ['q', 'x'.repeat(101)], ['state', 'all_india'],
  ])('rejects %s=%s', (field, raw) => {
    const { errors } = validateSchemeQuery({ [field]: raw });
    expect(errors.map((e) => e.field)).toEqual([field]);
  });

  test('rejects array params (?q=a&q=b)', () => {
    expect(validateSchemeQuery({ q: ['a', 'b'] }).errors[0].field).toBe('q');
  });
});

describe('parseId', () => {
  test.each([['1', 1], ['42', 42]])('%s -> %s', (raw, n) => expect(parseId(raw)).toBe(n));
  test.each(['0', '-1', '1.5', 'abc', '1e3', '99999999999', ''])('%s -> null', (raw) => expect(parseId(raw)).toBeNull());
});

describe('GET /api/schemes', () => {
  test('passes validated filters to the model and returns pagination', async () => {
    const search = jest.spyOn(Scheme, 'search').mockResolvedValue({ schemes: [{ id: 1, name: 'A' }], total: 25 });
    const res = await request(app).get('/api/schemes?category=retail&state=delhi&page=2&limit=10');
    expect(res.status).toBe(200);
    expect(search).toHaveBeenCalledWith({ category: 'retail', state: 'delhi', sort: 'name', order: 'asc', page: 2, limit: 10 });
    expect(res.body.data.schemes).toHaveLength(1);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  test('400 with field errors for bad params, model not called', async () => {
    const search = jest.spyOn(Scheme, 'search');
    const res = await request(app).get('/api/schemes?sort=evil&limit=1000');
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(['limit', 'sort']);
    expect(search).not.toHaveBeenCalled();
  });

  test('500 without leaking DB errors', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Scheme, 'search').mockRejectedValue(new Error('relation "schemes" does not exist'));
    const res = await request(app).get('/api/schemes');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/relation/);
  });
});

describe('GET /api/schemes/filters', () => {
  test('returns categories, locations and sorts', async () => {
    jest.spyOn(Scheme, 'filterOptions').mockResolvedValue({ categories: ['manufacturing'], locations: ['tamil_nadu'] });
    const res = await request(app).get('/api/schemes/filters');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ categories: ['manufacturing'], locations: ['tamil_nadu'], sorts: ['name', 'investment', 'newest'] });
  });
});

describe('GET /api/schemes/:id', () => {
  test('200 with the scheme', async () => {
    jest.spyOn(Scheme, 'findById').mockResolvedValue({ id: 7, name: 'X' });
    const res = await request(app).get('/api/schemes/7');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: 7, name: 'X' });
  });

  test('404 when absent', async () => {
    jest.spyOn(Scheme, 'findById').mockResolvedValue(null);
    expect((await request(app).get('/api/schemes/999')).status).toBe(404);
  });

  test('400 for a non-numeric id, model not called', async () => {
    const find = jest.spyOn(Scheme, 'findById');
    expect((await request(app).get('/api/schemes/abc')).status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });
});
