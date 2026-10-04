const rateLimit = require('express-rate-limit');
const { getRedis, isRedisConnected } = require('../cache');
const { logger } = require('../logger');

// Fixed-window counter that lives in Redis so limits survive backend restarts
// and hold across processes. Every increment falls back to an in-process Map
// whenever Redis is unavailable (outage, lazyConnect, or DISABLE_CACHE=1 in
// tests) — a rate limiter must fail open-ish (local counting), never 500.
// The window is a single atomic EVAL: INCR + PEXPIRE on first hit + PTTL.
const WINDOW_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local t = redis.call('PTTL', KEYS[1])
return {n, t}
`;

class RedisRateStore {
  constructor({ prefix = 'rl:', windowMs, client } = {}) {
    this.prefix = prefix;
    this.windowMs = windowMs || 60 * 1000;
    // Explicit client for tests; otherwise the shared cache.js connection.
    this.client = client;
    this.local = new Map(); // key -> { count, resetAt }
    this.lastWarnAt = 0;
  }

  // express-rate-limit v7 calls this once with the limiter options.
  init() {}

  _client() {
    if (this.client !== undefined) return this.client;
    return isRedisConnected() ? getRedis() : null;
  }

  _warnThrottled(err) {
    const now = Date.now();
    if (now - this.lastWarnAt > 60 * 1000) {
      this.lastWarnAt = now;
      logger.warn({ err: err && err.message }, 'rate-limit store error, using local counters');
    }
  }

  _localIncrement(key) {
    const now = Date.now();
    let entry = this.local.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.local.set(key, entry);
    }
    entry.count += 1;
    if (this.local.size > 50000) {
      for (const [k, v] of this.local) {
        if (v.resetAt <= now) this.local.delete(k);
      }
    }
    return { totalHits: entry.count, resetTime: new Date(entry.resetAt) };
  }

  async increment(key) {
    const client = this._client();
    if (client) {
      try {
        const reply = await client.eval(WINDOW_SCRIPT, 1, this.prefix + key, this.windowMs);
        const [totalHits, ttl] = Array.isArray(reply) ? reply : [reply, this.windowMs];
        return {
          totalHits,
          resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
        };
      } catch (err) {
        this._warnThrottled(err);
      }
    }
    return this._localIncrement(key);
  }

  async decrement(key) {
    const client = this._client();
    if (client) {
      try {
        await client.decr(this.prefix + key);
        return;
      } catch (err) {
        this._warnThrottled(err);
      }
    }
    const entry = this.local.get(key);
    if (entry) entry.count = Math.max(0, entry.count - 1);
  }

  async resetKey(key) {
    const client = this._client();
    if (client) {
      try {
        await client.del(this.prefix + key);
      } catch (err) {
        this._warnThrottled(err);
      }
    }
    this.local.delete(key);
  }
}

// Builds a limiter whose counters live in Redis (local fallback). `name`
// namespaces the keys — each limiter keeps an independent budget.
function makeLimiter({ name, windowMs, max, ...rest }) {
  return rateLimit({
    windowMs,
    max,
    store: new RedisRateStore({ prefix: `rl:${name}:`, windowMs }),
    ...rest,
  });
}

module.exports = { makeLimiter, RedisRateStore, WINDOW_SCRIPT };
