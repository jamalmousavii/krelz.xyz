const Redis = require('ioredis');

let redis = null;
let connected = false;

// Connect to Redis
try {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('connect', () => { connected = true; console.log('✅ Redis connected'); });
  redis.on('error', (err) => { connected = false; });
  redis.connect().catch(() => { connected = false; });
} catch (err) {
  console.log('⚠️ Redis not available, caching disabled');
}

// Cache middleware
function cacheMiddleware(ttl = 30) {
  return async (req, res, next) => {
    if (!connected || !redis) return next();
    if (req.method !== 'GET') return next();

    const key = `cache:${req.originalUrl}`;
    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (err) {}

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

// Invalidate cache by pattern
async function invalidateCache(pattern) {
  if (!connected || !redis) return;
  try {
    const keys = await redis.keys(`cache:${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {}
}

// Get cache stats
function getCacheStats() {
  return { connected, redis: !!redis };
}

module.exports = { cacheMiddleware, invalidateCache, getCacheStats };
