require('dotenv').config();

const Sentry = require('@sentry/node');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const WSServer = require('./ws');
const { cacheMiddleware, getCacheStats } = require('./cache');
const { logger } = require('./logger');

const authRoutes = require('./routes/auth');
const minerRoutes = require('./routes/miners');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
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

const allowedOrigins = [
  'https://krelz.xyz',
  'http://localhost:3000',
  'http://localhost:3002',
];
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
app.use(express.json({ limit: '1mb' }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Chat rate limit exceeded.' },
});
app.use('/api/chat', chatLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/miners', cacheMiddleware(10), minerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/stats', cacheMiddleware(30), statsRoutes);
app.use('/api/models', cacheMiddleware(60), modelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', cacheMiddleware(60), leaderboardRoutes);

app.get('/health', async (req, res) => {
  const cache = getCacheStats();
  let dbStatus = 'unknown';
  try {
    const pool = require('./database/pool');
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'disconnected';
  }

  res.json({
    status: 'ok',
    version: '3.16.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: cache.connected ? 'connected' : 'disconnected',
    postgres: dbStatus,
    sentry: !!process.env.SENTRY_DSN,
  });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Request error');

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Krelz Backend started');
  logger.info({ redis: getCacheStats().connected ? 'connected' : 'disconnected' }, 'Cache status');
});

wsServerHttp.listen(WS_PORT, () => {
  logger.info({ port: WS_PORT }, 'WebSocket server started');
});

module.exports = { app, server, wsServer };