const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const nowpayments = require('../services/nowpayments');
const { invalidateCache } = require('../cache');

const SUPPORTED_COINS = ['BTC', 'ETH', 'BNB', 'USDT', 'TRX', 'DOGE', 'XRP'];

// GET /api/payments/coins — supported coins
router.get('/coins', (req, res) => {
  const coins = nowpayments.getSupportedCoins();
  res.json({ success: true, coins });
});

// POST /api/payments/deposit/create — create invoice
router.post('/deposit/create', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { coin, amount } = req.body;

    if (!coin || !amount) {
      return res.status(400).json({ error: 'coin and amount required' });
    }

    if (!SUPPORTED_COINS.includes(coin.toUpperCase())) {
      return res.status(400).json({ error: `Unsupported coin: ${coin}` });
    }

    const coinUpper = coin.toUpperCase();
    const minAmount = nowpayments.getMinAmount(coinUpper);
    if (parseFloat(amount) < minAmount) {
      return res.status(400).json({ error: `Minimum ${minAmount} ${coinUpper}` });
    }

    // Create invoice
    const result = await nowpayments.createInvoice({
      userId,
      coin: coinUpper,
      amount: parseFloat(amount),
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Save deposit record
    await pool.query(
      `INSERT INTO coin_deposits (user_id, coin, amount, processor_id, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, coinUpper, amount, result.invoiceId]
    );

    res.status(201).json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
        payAddress: result.payAddress,
        payAmount: result.payAmount,
        coin: coinUpper,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/deposit/webhook — NowPayments IPN
router.post('/deposit/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];
    const payload = req.body;

    // Verify signature
    if (!nowpayments.verifyIPN(payload, signature)) {
      console.error('Invalid IPN signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process IPN
    const result = nowpayments.processIPN(payload);
    if (!result.success && result.status !== 'finished') {
      return res.json({ status: 'ignored', payment_status: result.status });
    }

    const { userId, coin, amount, txHash, processorId } = result;

    // Update deposit status
    await pool.query(
      "UPDATE coin_deposits SET status = 'completed', tx_hash = $1 WHERE processor_id = $2",
      [txHash, processorId]
    );

    // Credit user balance
    await pool.query(
      `INSERT INTO user_coin_balances (user_id, coin, chain, available)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, coin) DO UPDATE SET
       available = user_coin_balances.available + $4`,
      [userId, coin, nowpayments.getSupportedCoins()[coin]?.chain || coin.toLowerCase(), amount]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
       VALUES ('deposit', $1, $2, 'coin_deposit', $3, 'completed')`,
      [userId, amount, `${coin} deposit via NowPayments`]
    );

    invalidateCache('/api/payments/balance');

    console.log(`✅ Deposit confirmed: ${amount} ${coin} for user ${userId}`);
    res.json({ status: 'ok' });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/balance — user multi-coin balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT coin, available, total_earned, total_spent FROM user_coin_balances WHERE user_id = $1',
      [userId]
    );

    // Build balance object
    const balances = {};
    for (const coin of SUPPORTED_COINS) {
      const row = result.rows.find(r => r.coin === coin);
      balances[coin] = {
        available: parseFloat(row?.available || 0),
        total_earned: parseFloat(row?.total_earned || 0),
        total_spent: parseFloat(row?.total_spent || 0),
      };
    }

    // Add KRELZ governance balance
    const krelzResult = await pool.query(
      'SELECT COALESCE(available, 0) as available FROM user_balances WHERE user_id = $1',
      [userId]
    );
    balances.KRELZ = {
      available: parseFloat(krelzResult.rows[0]?.available || 0),
      total_earned: 0,
      total_spent: 0,
    };

    res.json({ success: true, balances });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/withdraw — withdraw to wallet
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { coin, amount, toAddress } = req.body;

    if (!coin || !amount || !toAddress) {
      return res.status(400).json({ error: 'coin, amount, and toAddress required' });
    }

    const coinUpper = coin.toUpperCase();
    if (!SUPPORTED_COINS.includes(coinUpper)) {
      return res.status(400).json({ error: `Unsupported coin: ${coin}` });
    }

    // Min withdrawal $10
    if (parseFloat(amount) < 10) {
      return res.status(400).json({ error: 'Minimum withdrawal is $10' });
    }

    // Check balance
    const balanceResult = await pool.query(
      'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2',
      [userId, coinUpper]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].available) < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const fee = nowpayments.calculateFee(amount, coinUpper);
    const totalDeduction = parseFloat(amount) + fee;

    if (parseFloat(balanceResult.rows[0].available) < totalDeduction) {
      return res.status(400).json({ error: `Insufficient balance. Need ${totalDeduction} ${coinUpper} (amount + fee)` });
    }

    // Deduct from balance
    await pool.query(
      `UPDATE user_coin_balances
       SET available = available - $1, total_spent = total_spent + $1
       WHERE user_id = $2 AND coin = $3`,
      [totalDeduction, userId, coinUpper]
    );

    // Create payout
    const payoutResult = await nowpayments.createPayout({
      address: toAddress,
      amount: parseFloat(amount),
      coin: coinUpper,
    });

    // Save withdrawal record
    await pool.query(
      `INSERT INTO coin_withdrawals (user_id, coin, amount, to_address, tx_hash, fee, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, coinUpper, amount, toAddress, payoutResult.txHash || null, fee, payoutResult.success ? 'completed' : 'failed']
    );

    if (!payoutResult.success) {
      // Refund balance
      await pool.query(
        `UPDATE user_coin_balances
         SET available = available + $1, total_spent = total_spent - $1
         WHERE user_id = $2 AND coin = $3`,
        [totalDeduction, userId, coinUpper]
      );
      return res.status(500).json({ error: payoutResult.error || 'Payout failed' });
    }

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
       VALUES ($1, 'withdrawal', $2, 'coin_withdrawal', $3, 'completed')`,
      [userId, amount, `${coinUpper} withdrawal to ${toAddress.slice(0, 10)}...`]
    );

    invalidateCache('/api/payments/balance');

    res.json({
      success: true,
      withdrawal: {
        coin: coinUpper,
        amount: parseFloat(amount),
        fee,
        toAddress,
        txHash: payoutResult.txHash,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/history — transaction history
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, limit = 50 } = req.query;

    let query = 'SELECT * FROM coin_deposits WHERE user_id = $1';
    let params = [userId];

    const deposits = await pool.query(query + ' ORDER BY created_at DESC LIMIT $2', [...params, limit]);
    const withdrawals = await pool.query(
      'SELECT * FROM coin_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );

    res.json({
      success: true,
      deposits: deposits.rows,
      withdrawals: withdrawals.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/deduct — internal deduct (for chat payments)
router.post('/deduct', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { coin, amount, reason } = req.body;

    if (!coin || !amount) {
      return res.status(400).json({ error: 'coin and amount required' });
    }

    const coinUpper = coin.toUpperCase();

    const balanceResult = await pool.query(
      'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2',
      [userId, coinUpper]
    );

    if (balanceResult.rows.length === 0 || parseFloat(balanceResult.rows[0].available) < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await pool.query(
      `UPDATE user_coin_balances
       SET available = available - $1, total_spent = total_spent + $1
       WHERE user_id = $2 AND coin = $3`,
      [amount, userId, coinUpper]
    );

    // 10% platform, 90% miner (handled in chat route)
    res.json({ success: true, message: `Deducted ${amount} ${coinUpper}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
