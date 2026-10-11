const crypto = require('crypto');
const pool = require('../database/pool');
const { logger } = require('../logger');

// Coder-API (v1) key handling. Keys look like `sk_<48 hex>`; only the
// sha256 is stored (key_hash), the prefix identifies the row for the user.
// Independent of JWT token_version: revocation = active=false or row delete.
function hashKey(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function newKey() {
  const raw = 'sk_' + crypto.randomBytes(24).toString('hex');
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 12) };
}

// Bearer sk_... → req.user { id } + req.apiKey { id, name }.
// Banned owners are rejected; inactive/unknown keys are 401 (no enumeration:
// same message either way).
async function authenticateApiKey(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Pass Authorization: Bearer sk_...' });
  }
  const raw = header.slice('Bearer '.length).trim();
  if (!raw.startsWith('sk_')) {
    return res.status(401).json({ error: 'Invalid API key.' });
  }
  try {
    const found = await pool.query(
      `SELECT k.id, k.user_id, k.name, u.banned
         FROM api_keys k JOIN users u ON u.id = k.user_id
        WHERE k.key_hash = $1 AND k.active = true`,
      [hashKey(raw)]
    );
    if (found.rows.length === 0 || found.rows[0].banned) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    const row = found.rows[0];
    req.user = { id: row.user_id, api_key_id: row.id };
    req.apiKey = { id: row.id, name: row.name };
    pool.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id])
      .catch((err) => logger.warn({ err }, 'api_keys last_used update failed'));
    next();
  } catch (err) {
    logger.error({ err }, 'API key auth failed');
    res.status(500).json({ error: 'Server error' });
  }
}

module.exports = { authenticateApiKey, hashKey, newKey };
