const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// POST /api/payments/create
router.post('/create', async (req, res) => {
  try {
    const { amount, from_address, to_address, type } = req.body;
    
    // ایجاد تراکنش
    const result = await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, status) 
       VALUES ($1, $2, $3, $4, 'pending') 
       RETURNING *`,
      [from_address, to_address, amount, type]
    );
    
    res.status(201).json({
      success: true,
      transaction: result.rows[0]
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/history
router.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100'
    );
    
    res.json({
      success: true,
      transactions: result.rows
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
