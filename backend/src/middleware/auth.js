const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { logger } = require('../logger');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is required');
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  logger.warn('JWT_SECRET is shorter than 32 characters — use a long random secret in production');
}

const JWT_OPTIONS = { algorithms: ['HS256'] };

// Verify JWT token
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTIONS);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Optional auth (doesn't fail if no token)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET, JWT_OPTIONS);
      req.user = decoded;
    } catch (err) { /* treat as anonymous */ }
  }
  next();
}

// Require admin role.
// The role claim inside the JWT can be stale (or, historically, self-assigned),
// so admin privileges are re-checked against the database with a short cache.
const adminRoleCache = new Map(); // userId -> { isAdmin, expiresAt }
const ADMIN_CACHE_MS = 60 * 1000;

async function isAdmin(userId) {
  if (!userId) return false;
  const cached = adminRoleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.isAdmin;

  let isAdminUser = false;
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    isAdminUser = result.rows.length > 0 && result.rows[0].role === 'admin';
  } catch (err) {
    logger.error({ err }, 'requireAdmin role lookup failed');
    return false; // fail closed
  }

  adminRoleCache.set(userId, { isAdmin: isAdminUser, expiresAt: Date.now() + ADMIN_CACHE_MS });
  return isAdminUser;
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  isAdmin(req.user.id)
    .then((ok) => {
      if (!ok) return res.status(403).json({ error: 'Admin access required.' });
      next();
    })
    .catch(() => res.status(500).json({ error: 'Server error' }));
}

module.exports = { authenticate, optionalAuth, requireAdmin };
