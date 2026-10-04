require('dotenv').config();

const Sentry = require('@sentry/node');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { makeLimiter } = require('./middleware/rateLimit');
const jwt = require('jsonwebtoken');
const pinoHttp = require('pino-http');
const WSServer = require('./ws');
const { cacheMiddleware, getCacheStats, closeCache } = require('./cache');
const { logger } = require('./logger');
const { authenticate } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const minerRoutes = require('./routes/miners');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const planRoutes = require('./routes/plans');
const tokenRoutes = require('./routes/token');
const statsRoutes = require('./routes/stats');
const modelRoutes = require('./routes/models');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const server = http.createServer(app);
const PORT = process.env.API_PORT || 3000;
const WS_PORT = process.env.WS_PORT || 8444;

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400 && res.statusCode < 500) return 'warn';
    if (res.statusCode >= 500 || err) return 'error';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
      },
      remoteAddress: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry error tracking enabled');
}

const wsServerHttp = http.createServer();
const wsServer = new WSServer(wsServerHttp);
app.set('wsServer', wsServer);

// B13: localhost origins are a DEV convenience only — shipping them in prod
// lets any local page on the box (or a crafted Host) ride the CORS allow-list.
const allowedOrigins = [
  'https://krelz.xyz',
  'https://www.krelz.xyz',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000', 'http://localhost:3002');
}
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://krelz.xyz", "wss://krelz.xyz", "wss://krelz.xyz:8443", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(httpLogger);
app.set('trust proxy', 1);
// B2: capture the exact bytes NowPayments signed (verify → called before
// JSON.parse) so IPN signature checks don't depend on re-serialisation.
app.use(express.json({
  limit: '8mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

const globalLimiter = makeLimiter({
  name: 'global',
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  // B13: IPN retries are payment-critical bursts — never let the shared
  // per-IP budget 429 a webhook (a dropped finished-IPN = unpaid invoice).
  skip: (req) => (req.originalUrl || req.url) === '/api/payments/deposit/webhook',
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

const authLimiter = makeLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Password reset endpoints are account-takeover vectors: keep them as tight as login.
const resetLimiter = makeLimiter({
  name: 'reset',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many reset attempts, try again in 15 minutes.' },
});
app.use('/api/auth/forgot-password', resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);

const chatLimiter = makeLimiter({
  name: 'chat',
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Chat rate limit exceeded.' },
});
app.use('/api/chat', chatLimiter);

// Anonymous chat stays free, but gets a much tighter per-IP budget than signed-in users.
const guestChatLimiter = makeLimiter({
  name: 'guest-chat',
  windowMs: 1 * 60 * 1000,
  max: 6,
  // B3: skip ONLY for a JWT that actually verifies — a bare
  // `Authorization: anything` header previously bypassed the guest budget
  // entirely (30 req/min instead of 6) without proving anything.
  skip: (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return false;
    try {
      jwt.verify(header.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
      return true;
    } catch (err) {
      return false;
    }
  },
  message: { error: 'Guest chat rate limit exceeded. Sign in for a higher limit.' },
});
app.use('/api/chat', guestChatLimiter);

app.use('/api/auth', authRoutes);
// /api/miners responses are per-user (they contain miner_token) — never cache them.
app.use('/api/miners', minerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/plans', planRoutes);
// Token router reads req.user everywhere: without authenticate every handler saw undefined.
app.use('/api/token', authenticate, tokenRoutes);
app.use('/api/stats', cacheMiddleware(30), statsRoutes);
app.use('/api/models', cacheMiddleware(15), modelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', cacheMiddleware(60), leaderboardRoutes);

// Readiness: fails when Postgres is down so nginx/load-balancer stop routing.
// Redis is report-only — caching is an optimisation, never a hard dependency.
app.get('/health', async (req, res) => {
  const cache = getCacheStats();
  let dbStatus = 'unknown';
  let dbOk = false;
  let dbLatencyMs = null;
  try {
    const pool = require('./database/pool');
    const startedAt = Date.now();
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - startedAt;
    dbStatus = 'connected';
    dbOk = true;
  } catch (e) {
    dbStatus = 'disconnected';
    logger.error({ err: e }, 'Health check: Postgres unreachable');
  }

  // B12: 'ok' while chat is actually unusable (Ollama down AND no miners
  // online) lied to operators and dashboards. Probe both — Ollama with a
  // 1s ceiling so health never hangs on it. Report degraded but keep HTTP
  // 200 when Postgres is fine: pulling this box from rotation would take
  // the whole API down, not just chat.
  let ollamaStatus = 'unknown';
  let onlineMiners = null;
  if (dbOk) {
    try {
      const axios = require('axios');
      await axios.get(`${process.env.OLLAMA_URL || 'http://localhost:11434'}/api/tags`, { timeout: 1000 });
      ollamaStatus = 'connected';
    } catch (e) {
      ollamaStatus = 'disconnected';
    }
    try {
      const pool = require('./database/pool');
      const r = await pool.query("SELECT COUNT(*)::int AS n FROM miners WHERE status = 'online'");
      onlineMiners = r.rows[0].n;
    } catch (e) {
      logger.error({ err: e }, 'Health check: miner count failed');
    }
  }

  const chatUsable = ollamaStatus === 'connected' || (onlineMiners !== null && onlineMiners > 0);
  res.status(dbOk ? 200 : 503).json({
    status: !dbOk ? 'degraded' : (chatUsable ? 'ok' : 'degraded'),
    version: require('../package.json').version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: cache.connected ? 'connected' : 'disconnected',
    postgres: dbStatus,
    db_latency_ms: dbLatencyMs,
    ollama: ollamaStatus,
    online_miners: onlineMiners,
    sentry: !!process.env.SENTRY_DSN,
  });
});

// Liveness: process is up, regardless of dependencies.
app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Request error');

  // B1: honor the error's own status — body-parser/validation failures are
  // 400/413/415, not 500. Forcing 500 lied to clients AND flooded Sentry
  // with what is really client misbehaviour.
  const status = err.status || err.statusCode || 500;

  if (process.env.SENTRY_DSN && status >= 500) {
    Sentry.captureException(err);
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
  });
});

// v3.18.4: bind to loopback only — nginx is the sole public entry point
server.listen(PORT, '127.0.0.1', () => {
  logger.info({ port: PORT }, 'Krelz Backend started');
  logger.info({ redis: getCacheStats().connected ? 'connected' : 'disconnected' }, 'Cache status');

  // B4/B11: hourly payment reconciliation + old-media prune. Both jobs are
  // idempotent (exactly-once claims; NULL-ing stale media is repeat-safe), so
  // restarts and overlaps are harmless. First run waits 5 minutes after boot.
  const { runMaintenance } = require('./services/maintenance');
  setTimeout(() => {
    runMaintenance();
    setInterval(runMaintenance, 60 * 60 * 1000);
  }, 5 * 60 * 1000);
});

wsServerHttp.listen(WS_PORT, '127.0.0.1', () => {
  logger.info({ port: WS_PORT }, 'WebSocket server started');
});

// --- Graceful shutdown ----------------------------------------------------
// On SIGTERM/SIGINT: stop accepting new work, drain HTTP + WS, then release
// pool/Redis connections. systemd sends SIGTERM then SIGKILL after
// TimeoutStopSec, so we force-exit well before that.
const SHUTDOWN_TIMEOUT_MS = 15000;
let shuttingDown = false;

function closeServer(srv) {
  if (!srv || !srv.listening) return Promise.resolve();
  if (typeof srv.closeIdleConnections === 'function') srv.closeIdleConnections();
  return new Promise((resolve) => srv.close(resolve));
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutdown initiated');

  const forceTimer = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceTimer.unref();

  try {
    await closeServer(server);
    await wsServer.close();
    await closeServer(wsServerHttp);
    await closeCache();
    const pool = require('./database/pool');
    await pool.end();
    clearTimeout(forceTimer);
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Last-resort handlers: record the failure instead of dying silently.
// uncaughtException exits (state unknown); unhandledRejection keeps serving
// because one failed async task must not take down a live service.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception, exiting');
  process.exit(1);
});

module.exports = { app, server, wsServer };