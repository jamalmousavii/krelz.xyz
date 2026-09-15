require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const WSServer = require('./ws');

const authRoutes = require('./routes/auth');
const minerRoutes = require('./routes/miners');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const tokenRoutes = require('./routes/token');
const statsRoutes = require('./routes/stats');
const modelRoutes = require('./routes/models');

const app = express();
const server = http.createServer(app);
const PORT = process.env.API_PORT || 3000;

// Initialize WebSocket server
const wsServer = new WSServer(server);

// Make wsServer available to routes
app.set('wsServer', wsServer);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/miners', minerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/models', modelRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

server.listen(PORT, () => {
  console.log(`🚀 Krelz Backend running on port ${PORT}`);
  console.log(`🔌 WebSocket on ws://0.0.0.0:${PORT}/ws`);
});

module.exports = { app, server, wsServer };
