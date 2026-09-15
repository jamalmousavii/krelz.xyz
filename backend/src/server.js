require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WSServer = require('./ws');

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

// Initialize WebSocket server
const wsServer = new WSServer(server);
app.set('wsServer', wsServer);

// --- Security ---
// CORS whitelist
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

// Helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://js.clerk.dev"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://krelz.xyz", "wss://krelz.xyz", "https://accounts.google.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Body parser with size limit
app.use(express.json({ limit: '1mb' }));

// --- Rate Limits ---
// Global API limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// Auth: stricter limit
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, try again in 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Chat: moderate limit
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Chat rate limit exceeded.' },
});
app.use('/api/chat', chatLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/miners', minerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`🚀 Krelz Backend v2.1.0 on port ${PORT}`);
  console.log(`🔌 WebSocket on ws://0.0.0.0:${PORT}/ws`);
  console.log(`🔒 Security: CORS, CSP, Rate Limits enabled`);
});

module.exports = { app, server, wsServer };
