const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const { newKey } = require('../middleware/apiKey');
const { logger } = require('../logger');

// All routes are JWT-authenticated (dashboard-owned keys).
router.use(authenticate);

// GET /api/keys — list own keys (hashes never leave the server).
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, key_prefix, active, rate_limit, last_used_at, created_at
         FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, keys: result.rows });
  } catch (err) {
    logger.error({ err }, 'GET /api/keys failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/keys — mint a key. The raw secret is returned ONCE.
router.post('/', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
    if (!name) {
      return res.status(400).json({ error: 'name required (max 100 chars)' });
    }
    const count = await pool.query('SELECT COUNT(*)::int AS n FROM api_keys WHERE user_id = $1 AND active = true', [req.user.id]);
    if (count.rows[0].n >= 10) {
      return res.status(400).json({ error: 'Maximum 10 active keys' });
    }
    const { raw, hash, prefix } = newKey();
    const inserted = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4) RETURNING id, name, key_prefix, active, created_at`,
      [req.user.id, name, hash, prefix]
    );
    res.status(201).json({ success: true, key: raw, api_key: inserted.rows[0] });
  } catch (err) {
    logger.error({ err }, 'POST /api/keys failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/keys/:id — revoke (row kept for audit, flipped inactive).
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: 'Key id is required' });
    }
    const result = await pool.query(
      `UPDATE api_keys SET active = false WHERE id = $1 AND user_id = $2 AND active = true
       RETURNING id`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Key not found' });
    }
    res.json({ success: true, revoked: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/keys failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
