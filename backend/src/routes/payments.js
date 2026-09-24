const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const nowpayments = require('../services/nowpayments');
const { invalidateCache } = require('../cache');

// GET /api/payments/coins — still returns coin list for invoice display
router.get('/coins', (req, res) => {
  const coins = nowpayments.getSupportedCoins();
  res.json({ success: true, coins });
});

// POST /api/payments/deposit/create — create USD invoice (customer picks coin on NP page)
router.post('/deposit/create', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Accept amount_usd or amount (legacy)
    const amount = parseFloat(req.body.amount_usd ?? req.body.amount);

    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      return res.status(400).json({ error: 'amount_usd required' });
    }

    const minUsd = nowpayments.getMinUsdDeposit();
    if (amount < minUsd) {
      return res.status(400).json({ error: `Minimum deposit is $${minUsd} USD` });
    }

    // Optional coin pre-select (customer can still change on NP page)
    const coin = req.body.coin ? String(req.body.coin).toUpperCase() : undefined;
    if (coin && !nowpayments.getSupportedCoins()[coin]) {
      return res.status(400).json({ error: `Unsupported coin: ${coin}` });
    }

    const result = await nowpayments.createInvoice({
      userId,
      coin,
      amount,
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Save deposit record (USD)
    await pool.query(
      `INSERT INTO coin_deposits (user_id, coin, amount, processor_id, status)
       VALUES ($1, 'USD', $2, $3, 'pending')`,
      [userId, amount, result.invoiceId]
    );

    res.status(201).json({
      success: true,
      invoice: {
        id: result.invoiceId,
        url: result.invoiceUrl,
        payAddress: result.payAddress,
        payAmount: result.payAmount,
        amountUsd: amount,
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

    if (!nowpayments.verifyIPN(payload, signature)) {
      console.error('Invalid IPN signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const result = await nowpayments.processIPN(payload);
    if (!result.success || result.status !== 'finished') {
      return res.json({ status: 'ignored', payment_status: result.status });
    }

    const { userId, amount, txHash, processorId } = result;

    if (!userId || !(amount > 0)) {
      return res.json({ status: 'ignored', reason: 'invalid payload' });
    }

    // Update deposit status
    await pool.query(
      "UPDATE coin_deposits SET status = 'completed', tx_hash = $1 WHERE processor_id = $2",
      [txHash, processorId]
    );

    // Credit USD balance
    await pool.query(
      `INSERT INTO user_coin_balances (user_id, coin, chain, available)
       VALUES ($1, 'USD', 'usd', $2)
       ON CONFLICT (user_id, coin) DO UPDATE SET
       available = user_coin_balances.available + $2,
       total_earned = user_coin_balances.total_earned + $2`,
      [userId, amount]
    );

    // Record transaction
    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
       VALUES ('deposit', $1, $2, 'usd_deposit', $3, 'completed')`,
      [userId, amount, `USD deposit via NowPayments (${result.cryptoCoin || 'crypto'} paid)`]
    );

    invalidateCache('/api/payments/balance');

    console.log(`✅ Deposit confirmed: $${amount} USD for user ${userId}`);
    res.json({ status: 'ok' });

  } catch (err) {
    console.error('Webhook error:', err);
    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      return res.status(503).json({ error: 'Payment webhook not configured (missing IPN secret)' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/balance — USD balance only
router.get('/balance', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "SELECT available, total_earned, total_spent FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
      [userId]
    );

    const row = result.rows[0];
    const balances = {
      USD: {
        available: parseFloat(row?.available || 0),
        total_earned: parseFloat(row?.total_earned || 0),
        total_spent: parseFloat(row?.total_spent || 0),
      },
    };

    res.json({ success: true, balances, currency: 'USD' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/withdraw — USDT TRC-20 only, min $5, fee paid by sender
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Accept USD amount + TRC20 address; coin forced to USDT for payout
    const amount = parseFloat(req.body.amount);
    const toAddress = req.body.toAddress;

    if (!amount || !toAddress) {
      return res.status(400).json({ error: 'amount and toAddress required' });
    }

    if (amount < 5) {
      return res.status(400).json({ error: 'Minimum withdrawal is $5' });
    }

    // Fee paid by sender
    const fee = nowpayments.getWithdrawFee(amount);
    const totalDeduction = amount + fee;

    const balanceResult = await pool.query(
      "SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
      [userId]
    );

    const available = parseFloat(balanceResult.rows[0]?.available || 0);
    if (available < totalDeduction) {
      return res.status(400).json({
        error: `Insufficient balance. Need $${totalDeduction.toFixed(2)} ($${amount.toFixed(2)} + $${fee.toFixed(2)} fee)`
      });
    }

    // Deduct USD (amount + fee, sender pays fee)
    await pool.query(
      `UPDATE user_coin_balances
       SET available = available - $1, total_spent = total_spent + $1
       WHERE user_id = $2 AND coin = 'USD'`,
      [totalDeduction, userId]
    );

    // Create payout in USDT TRC-20 (1 USD ≈ 1 USDT)
    const usdtAmount = amount;
    const payoutResult = await nowpayments.createPayout({
      address: toAddress,
      amount: usdtAmount,
      coin: 'USDT',
    });

    await pool.query(
      `INSERT INTO coin_withdrawals (user_id, coin, amount, to_address, tx_hash, fee, status)
       VALUES ($1, 'USD', $2, $3, $4, $5, $6)`,
      [userId, amount, toAddress, payoutResult.txHash || null, fee, payoutResult.success ? 'completed' : 'failed']
    );

    if (!payoutResult.success) {
      // Refund
      await pool.query(
        `UPDATE user_coin_balances
         SET available = available + $1, total_spent = total_spent - $1
         WHERE user_id = $2 AND coin = 'USD'`,
        [totalDeduction, userId]
      );
      return res.status(500).json({ error: payoutResult.error || 'Payout failed' });
    }

    await pool.query(
      `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
       VALUES ($1, 'withdrawal', $2, 'usd_withdrawal', $3, 'completed')`,
      [userId, amount, `USD withdrawal (USDT TRC-20) to ${toAddress.slice(0, 10)}...`]
    );

    invalidateCache('/api/payments/balance');

    res.json({
      success: true,
      withdrawal: {
        coin: 'USDT',
        network: 'TRC-20',
        amount,
        fee,
        totalDeduction,
        toAddress,
        txHash: payoutResult.txHash,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/history — USD transactions
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    const deposits = await pool.query(
      "SELECT * FROM coin_deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit]
    );
    const withdrawals = await pool.query(
      "SELECT * FROM coin_withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
      [userId, limit]
    );

    res.json({
      success: true,
      currency: 'USD',
      deposits: deposits.rows,
      withdrawals: withdrawals.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/deduct — internal deduct (for chat payments) — USD only
router.post('/deduct', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);
    const reason = req.body.reason;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount required' });
    }

    const balanceResult = await pool.query(
      "SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
      [userId]
    );

    const available = parseFloat(balanceResult.rows[0]?.available || 0);
    if (available < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await pool.query(
      `UPDATE user_coin_balances
       SET available = available - $1, total_spent = total_spent + $1
       WHERE user_id = $2 AND coin = 'USD'`,
      [amount, userId]
    );

    res.json({ success: true, message: `Deducted $${amount.toFixed(4)} USD` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
