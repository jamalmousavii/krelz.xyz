const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database/pool');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    
    // بررسی وجود کاربر
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // هش کردن رمز
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ایجاد کاربر
    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role || 'user']
    );
    
    // ایجاد JWT
    const token = jwt.sign(
      { id: result.rows[0].id, email, role },
      process.env.JWT_SECRET || 'krelz-secret',
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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // پیدا کردن کاربر
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // بررسی رمز
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // ایجاد JWT
    const token = jwt.sign(
      { id: user.id, email, role: user.role },
      process.env.JWT_SECRET || 'krelz-secret',
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
