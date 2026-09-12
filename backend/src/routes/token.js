const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// GET /api/token/balance
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.id;
    
    // دریافت موجودی از دیتابیس (یا بلاکچین)
    const stakingResult = await pool.query(
      'SELECT COALESCE(SUM(amount), 0) as staked FROM staking WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    res.json({
      success: true,
      balance: 0, // از بلاکچین دریافت می‌شود
      staked: parseFloat(stakingResult.rows[0].staked),
      available: 0
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/token/stake
router.post('/stake', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // ایجاد استیک
    const result = await pool.query(
      `INSERT INTO staking (user_id, amount, status) 
       VALUES ($1, $2, 'active') 
       RETURNING *`,
      [userId, amount]
    );
    
    res.status(201).json({
      success: true,
      staking: result.rows[0]
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/token/unstake
router.post('/unstake', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // بررسی موجودی
    const stakingResult = await pool.query(
      'SELECT SUM(amount) as total FROM staking WHERE user_id = $1 AND status = $2',
      [userId, 'active']
    );
    
    const totalStaked = parseFloat(stakingResult.rows[0].total || 0);
    
    if (amount > totalStaked) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // به‌روزرسانی استیک
    await pool.query(
      `UPDATE staking 
       SET amount = amount - $1, 
           status = CASE WHEN amount - $1 <= 0 THEN 'withdrawn' ELSE 'active' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND status = 'active'`,
      [amount, userId]
    );
    
    res.json({
      success: true,
      message: 'Unstaked successfully'
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
