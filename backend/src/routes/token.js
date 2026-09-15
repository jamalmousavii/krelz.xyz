const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { invalidateCache } = require('../cache');

// GET /api/token/balance
router.get('/balance', async (req, res) => {
  try {
    const userId = req.user?.id;

    // Get from user_balances table
    const balanceResult = await pool.query(
      `SELECT COALESCE(available, 0) as available, COALESCE(total_earned, 0) as total_earned, COALESCE(total_spent, 0) as total_spent
       FROM user_balances WHERE user_id = $1`,
      [userId]
    );

    // Get staked amount
    const stakingResult = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as staked FROM staking WHERE user_id = $1 AND status = 'active'",
      [userId]
    );

    const balance = balanceResult.rows[0] || { available: 0, total_earned: 0, total_spent: 0 };

    res.json({
      success: true,
      available: parseFloat(balance.available),
      total_earned: parseFloat(balance.total_earned),
      total_spent: parseFloat(balance.total_spent),
      staked: parseFloat(stakingResult.rows[0].staked)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/token/deposit
router.post('/deposit', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount, tx_hash } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create deposit record
    const result = await pool.query(
      `INSERT INTO deposits (user_id, amount, tx_hash, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [userId, amount, tx_hash]
    );

    // Auto-approve for now (in production, verify on-chain)
    await pool.query(
      "UPDATE deposits SET status = 'confirmed' WHERE id = $1",
      [result.rows[0].id]
    );

    // Update or create user balance
    await pool.query(
      `INSERT INTO user_balances (user_id, available, total_earned)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id) DO UPDATE SET
       available = user_balances.available + $2`,
      [userId, amount]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, tx_hash, status)
       VALUES ('deposit', 'user', $1, 'deposit', $2, 'completed')`,
      [amount, tx_hash]
    );

    res.status(201).json({
      success: true,
      deposit: result.rows[0],
      message: `Deposited ${amount} KRELZ`
    });
    invalidateCache('/api/stats');
    invalidateCache('/api/leaderboard');

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/token/deduct
router.post('/deduct', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Check balance
    const balanceResult = await pool.query(
      'SELECT available FROM user_balances WHERE user_id = $1',
      [userId]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].available) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct
    await pool.query(
      `UPDATE user_balances
       SET available = available - $1, total_spent = total_spent + $1
       WHERE user_id = $2`,
      [amount, userId]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, status)
       VALUES ('user', 'platform', $1, $2, 'completed')`,
      [amount, reason || 'api_usage']
    );

    res.json({
      success: true,
      message: `Deducted ${amount} KRELZ`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/token/transfer
router.post('/transfer', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { to_user_id, amount } = req.body;

    if (!amount || amount <= 0 || !to_user_id) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    // Check sender balance
    const balanceResult = await pool.query(
      'SELECT available FROM user_balances WHERE user_id = $1',
      [userId]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].available) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from sender
    await pool.query(
      'UPDATE user_balances SET available = available - $1 WHERE user_id = $2',
      [amount, userId]
    );

    // Add to receiver
    await pool.query(
      `INSERT INTO user_balances (user_id, available)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET available = user_balances.available + $2`,
      [to_user_id, amount]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, status)
       VALUES ($1, $2, $3, 'transfer', 'completed')`,
      [userId, to_user_id, amount]
    );

    res.json({
      success: true,
      message: `Transferred ${amount} KRELZ`
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

    // Check balance
    const balanceResult = await pool.query(
      'SELECT available FROM user_balances WHERE user_id = $1',
      [userId]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].available) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Deduct from available
    await pool.query(
      'UPDATE user_balances SET available = available - $1 WHERE user_id = $2',
      [amount, userId]
    );

    // Create stake
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

    const stakingResult = await pool.query(
      "SELECT SUM(amount) as total FROM staking WHERE user_id = $1 AND status = 'active'",
      [userId]
    );

    const totalStaked = parseFloat(stakingResult.rows[0].total || 0);

    if (amount > totalStaked) {
      return res.status(400).json({ error: 'Insufficient staked balance' });
    }

    // Update stake
    await pool.query(
      `UPDATE staking
       SET amount = amount - $1,
           status = CASE WHEN amount - $1 <= 0 THEN 'withdrawn' ELSE 'active' END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND status = 'active'`,
      [amount, userId]
    );

    // Add back to available
    await pool.query(
      'UPDATE user_balances SET available = available + $1 WHERE user_id = $2',
      [amount, userId]
    );

    res.json({
      success: true,
      message: `Unstaked ${amount} KRELZ`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
