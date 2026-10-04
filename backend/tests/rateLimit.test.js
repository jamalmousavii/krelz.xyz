const express = require('express');
const request = require('supertest');
const { makeLimiter, RedisRateStore, WINDOW_SCRIPT } = require('../src/middleware/rateLimit');

describe('RedisRateStore — local fallback (DISABLE_CACHE=1, no client)', () => {
  it('counts hits per key with a future reset time', async () => {
    const store = new RedisRateStore({ prefix: 'rl:t:', windowMs: 60000, client: null });
    const first = await store.increment('1.2.3.4');
    const second = await store.increment('1.2.3.4');
    const other = await store.increment('5.6.7.8');
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(other.totalHits).toBe(1);
    expect(second.resetTime.getTime()).toBeGreaterThan(Date.now());
    expect(second.resetTime.getTime()).toBeLessThanOrEqual(Date.now() + 60000);
  });

  it('starts a fresh window after the old one expires', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      const store = new RedisRateStore({ prefix: 'rl:t:', windowMs: 60000, client: null });
      await store.increment('k');
      await store.increment('k');
      jest.advanceTimersByTime(60001);
      const after = await store.increment('k');
      expect(after.totalHits).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('resetKey clears the count', async () => {
    const store = new RedisRateStore({ prefix: 'rl:t:', windowMs: 60000, client: null });
    await store.increment('k');
    await store.increment('k');
    await store.resetKey('k');
    const after = await store.increment('k');
    expect(after.totalHits).toBe(1);
  });

  it('decrement never goes below zero', async () => {
    const store = new RedisRateStore({ prefix: 'rl:t:', windowMs: 60000, client: null });
    await store.decrement('k');
    const after = await store.increment('k');
    expect(after.totalHits).toBe(1);
  });
});

describe('RedisRateStore — redis path', () => {
  it('runs the atomic window script and maps the reply', async () => {
    const client = {
      eval: jest.fn().mockResolvedValue([5, 30000]),
      decr: jest.fn().mockResolvedValue(4),
      del: jest.fn().mockResolvedValue(1),
    };
    const store = new RedisRateStore({ prefix: 'rl:x:', windowMs: 60000, client });
    const r = await store.increment('ip');
    expect(r.totalHits).toBe(5);
    expect(r.resetTime.getTime()).toBeGreaterThan(Date.now() + 29000);
    expect(client.eval).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, windowMs] = client.eval.mock.calls[0];
    expect(script).toBe(WINDOW_SCRIPT);
    expect(numKeys).toBe(1);
    expect(key).toBe('rl:x:ip');
    expect(windowMs).toBe(60000);
  });

  it('falls back to local counting when redis throws', async () => {
    const client = {
      eval: jest.fn().mockRejectedValue(new Error('connection is closed')),
      decr: jest.fn().mockRejectedValue(new Error('connection is closed')),
      del: jest.fn().mockRejectedValue(new Error('connection is closed')),
    };
    const store = new RedisRateStore({ prefix: 'rl:x:', windowMs: 60000, client });
    const first = await store.increment('ip');
    const second = await store.increment('ip');
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    // both paths keep working after the failure
    await store.decrement('ip');
    await store.resetKey('ip');
    expect((await store.increment('ip')).totalHits).toBe(1);
  });

  it('resetKey deletes the redis key', async () => {
    const client = {
      eval: jest.fn().mockResolvedValue([1, 60000]),
      decr: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    const store = new RedisRateStore({ prefix: 'rl:x:', windowMs: 60000, client });
    await store.resetKey('ip');
    expect(client.del).toHaveBeenCalledWith('rl:x:ip');
  });
});

describe('makeLimiter — express integration', () => {
  const buildApp = (opts) => {
    const app = express();
    app.get('/ping', makeLimiter({ name: 'test', windowMs: 60000, ...opts }), (req, res) => {
      res.json({ ok: true });
    });
    return app;
  };

  it('returns 429 with the configured message after max hits', async () => {
    const app = buildApp({ max: 2, message: { error: 'limited' } });
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    const blocked = await request(app).get('/ping');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'limited' });
  });

  it('skip keeps a route out of the budget', async () => {
    const app = buildApp({
      max: 1,
      skip: (req) => req.query.bypass === '1',
      message: { error: 'limited' },
    });
    expect((await request(app).get('/ping?bypass=1')).status).toBe(200);
    expect((await request(app).get('/ping?bypass=1')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(429);
  });

  it('different limiter names keep independent budgets', async () => {
    const a = buildApp({ max: 1, message: { error: 'a' } });
    const b = express();
    b.get('/ping', makeLimiter({ name: 'other', windowMs: 60000, max: 1, message: { error: 'b' } }), (req, res) => res.json({ ok: true }));
    expect((await request(a).get('/ping')).status).toBe(200);
    expect((await request(a).get('/ping')).status).toBe(429);
    // the other store is untouched by a's hits
    expect((await request(b).get('/ping')).status).toBe(200);
    expect((await request(b).get('/ping')).status).toBe(429);
  });
});
