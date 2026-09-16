require('dotenv').config();

const Sentry = require('@sentry/node');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WSServer = require('./ws');
const { cacheMiddleware, getCacheStats } = require('./cache');

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

// --- Sentry ---
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('🔒 Sentry error tracking enabled');
}

// Initialize WebSocket server
const wsServer = new WSServer(server);
app.set('wsServer', wsServer);

// --- Security ---
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
      connectSrc: ["'self'", "https://krelz.xyz", "wss://krelz.xyz", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(morgan('combined'));
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

// --- Rate Limits ---
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

// --- Routes (with cache where needed) ---
app.use('/api/auth', authRoutes);
app.use('/api/miners', cacheMiddleware(10), minerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/stats', cacheMiddleware(30), statsRoutes);
app.use('/api/models', cacheMiddleware(60), modelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', cacheMiddleware(60), leaderboardRoutes);

// Health check
app.get('/health', (req, res) => {
  const cache = getCacheStats();
  res.json({
    status: 'ok',
    version: '3.11.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: cache.connected ? 'connected' : 'disconnected',
    sentry: !!process.env.SENTRY_DSN,
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling (with Sentry)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`🚀 Krelz Backend v3.11.0 on port ${PORT}`);
  console.log(`🔌 WebSocket on ws://0.0.0.0:${PORT}/ws`);
  console.log(`🔒 Security: CORS, CSP, Rate Limits`);
  console.log(`📦 Cache: Redis ${getCacheStats().connected ? '✅' : '❌'}`);
});

module.exports = { app, server, wsServer };
