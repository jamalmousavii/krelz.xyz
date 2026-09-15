const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');
const { OAuth2Client } = require('google-auth-library');
const { validate, registerRules, loginRules, googleAuthRules } = require('../middleware/validate');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'krelz-secret';

// POST /api/auth/register
router.post('/register', registerRules, validate, async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role || 'user']
    );

    // Create empty balance
    await pool.query(
      'INSERT INTO user_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [result.rows[0].id]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, email, role: result.rows[0].role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.password) {
      return res.status(401).json({ error: 'This account uses Google Login. Please sign in with Google.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/google
router.post('/google', googleAuthRules, validate, async (req, res) => {
  try {
    const { credential } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1 OR email = $2',
      [googleId, email]
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO users (email, name, avatar, google_id, role)
         VALUES ($1, $2, $3, $4, 'user')
         RETURNING id, email, name, avatar, role`,
        [email, name, picture, googleId]
      );
      // Create balance for new user
      await pool.query(
        'INSERT INTO user_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [result.rows[0].id]
      );
    } else {
      result = await pool.query(
        `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             name = COALESCE(name, $2),
             avatar = COALESCE(avatar, $3),
             updated_at = CURRENT_TIMESTAMP
         WHERE email = $4
         RETURNING id, email, name, avatar, role`,
        [googleId, name, picture, email]
      );
    }

    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user });

  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

module.exports = router;
