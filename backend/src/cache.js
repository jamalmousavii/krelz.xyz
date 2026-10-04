const Redis = require('ioredis');
const { logger } = require('./logger');

let redis = null;
let connected = false;

// Connect to Redis. DISABLE_CACHE=1 skips the client entirely — used by the
// test suite (and handy for local dev boxes without Redis).
const cacheDisabled = process.env.DISABLE_CACHE === '1' || process.env.DISABLE_CACHE === 'true';

if (cacheDisabled) {
  logger.info('Cache disabled (DISABLE_CACHE)');
} else {
  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // keep retrying forever (with a cap) instead of giving up permanently
        return Math.min(times * 200, 5000);
      },
      lazyConnect: true,
    });

    redis.on('connect', () => { connected = true; logger.info('Redis connected'); });
    redis.on('ready', () => { connected = true; });
    redis.on('error', (err) => {
      if (connected) logger.warn({ err: err.message }, 'Redis connection lost, caching disabled until it returns');
      connected = false;
    });
    redis.connect().catch(() => { connected = false; });
  } catch (err) {
    logger.warn('Redis not available, caching disabled');
    redis = null;
  }
}

// Response cache. MUST NEVER be applied to authenticated responses: the key is
// derived from the URL only, so a cached body would be served to other users.
function isCacheableRequest(req) {
  if (req.method !== 'GET') return false;
  // The key is URL-only, so anything that could identify the caller must
  // bypass the cache: bearer headers, cookies (a future/session auth) and
  // any middleware-resolved user. This runs before route auth, so req.user
  // is checked defensively as well.
  if (req.headers.authorization) return false;
  if (req.headers.cookie) return false;
  if (req.user) return false;
  return true;
}

function cacheMiddleware(ttl = 30) {
  return async (req, res, next) => {
    if (!connected || !redis) return next();
    if (!isCacheableRequest(req)) return next();

    const key = `cache:${req.originalUrl}`;
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'cache read failed');
    }

    // Override res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (connected && redis && body && body.success) {
        redis.setex(key, ttl, JSON.stringify(body)).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

// Invalidate cache by pattern. Uses SCAN (not KEYS) so it never blocks Redis.
async function invalidateCache(pattern) {
  if (!connected || !redis) return;
  try {
    const stream = redis.scanStream({ match: `cache:${pattern}*`, count: 100 });
    const keys = [];
    for await (const batch of stream) keys.push(...batch);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'cache invalidation failed');
  }
}

// Get cache stats
function getCacheStats() {
  return { connected, redis: !!redis };
}

async function closeCache() {
  if (!redis) return;
  try {
    await redis.quit();
  } catch (err) {
    redis.disconnect();
  }
}

module.exports = { cacheMiddleware, invalidateCache, getCacheStats, closeCache, isCacheableRequest };
