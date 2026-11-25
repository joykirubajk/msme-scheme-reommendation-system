import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import app from '../app.js';
import { errorHandler, notFound } from '../middleware/errorHandler.js';

describe('app baseline', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  test('unknown route returns JSON 404', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Route not found/);
  });

  test('CORS allows the CRA dev origin (localhost:3000)', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('malformed JSON body returns 400 JSON, not an HTML stack trace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid JSON in request body' });
  });
});

describe('errorHandler', () => {
  const makeApp = () => {
    const a = express();
    a.get('/boom', () => { throw new Error('secret db detail: password=hunter2'); });
    a.get('/teapot', (req, res, next) => { const e = new Error('short and stout'); e.status = 418; next(e); });
    a.use(notFound);
    a.use(errorHandler);
    return a;
  };

  test('unexpected error -> generic 500 with no stack or internal message', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(makeApp()).get('/boom');
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toMatch(/hunter2|stack|at /);
  });

  test('error with 4xx status keeps its message', async () => {
    const res = await request(makeApp()).get('/teapot');
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ success: false, message: 'short and stout' });
  });
});
