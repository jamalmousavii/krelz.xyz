const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { authenticate } = require('../middleware/auth');
const nowpayments = require('../services/nowpayments');
const { invalidateCache } = require('../cache');
const { logger } = require('../logger');

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

    // Save deposit record (USD). order_id is the IPN correlation key.
    await pool.query(
      `INSERT INTO coin_deposits (user_id, coin, amount, processor_id, order_id, status)
       VALUES ($1, 'USD', $2, $3, $4, 'pending')`,
      [userId, amount, result.invoiceId, result.orderId]
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
    logger.error({ err }, 'POST /api/payments/deposit/create failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/deposit/webhook — NowPayments IPN
router.post('/deposit/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-nowpayments-sig'];
    const payload = req.body;

    if (!nowpayments.verifyIPN(payload, signature)) {
      logger.error('Rejected IPN: invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const result = await nowpayments.processIPN(payload);
    if (!result.success || result.status !== 'finished') {
      return res.json({ status: 'ignored', payment_status: result.status });
    }

    const { userId, amount, txHash, orderId, invoiceId, cryptoCoin } = result;

    if (!userId || !(amount > 0)) {
      return res.json({ status: 'ignored', reason: 'invalid payload' });
    }

    const client = await pool.connect();
    let credited = false;
    let storedAmount = amount;
    try {
      await client.query('BEGIN');

      // Claim the deposit exactly once: UPDATE only while still pending, so a
      // replayed/forged 'finished' IPN can never credit twice.
      const claim = await client.query(
        `UPDATE coin_deposits
            SET status = 'completed', tx_hash = COALESCE($1, tx_hash)
          WHERE user_id = $2
            AND status = 'pending'
            AND (order_id = $3 OR processor_id = $3 OR processor_id = $4)
          RETURNING id, amount`,
        [txHash, userId, orderId, invoiceId]
      );

      if (claim.rows.length === 0) {
        // Already completed (replay) — acknowledge without crediting.
        await client.query('COMMIT');
        logger.warn({ userId, orderId }, 'IPN replay ignored (deposit already processed)');
        return res.json({ status: 'ok', deduped: true });
      }

      // Credit the amount we stored when the invoice was created, never the
      // amount asserted by the webhook payload.
      storedAmount = parseFloat(claim.rows[0].amount);

      await client.query(
        `INSERT INTO user_coin_balances (user_id, coin, chain, available, total_earned)
         VALUES ($1, 'USD', 'usd', $2, $2)
         ON CONFLICT (user_id, coin) DO UPDATE SET
         available = user_coin_balances.available + $2,
         total_earned = user_coin_balances.total_earned + $2`,
        [userId, storedAmount]
      );

      await client.query(
        `INSERT INTO transactions (from_address, to_address, amount, type, description, status)
         VALUES ('deposit', $1, $2, 'usd_deposit', $3, 'completed')`,
        [userId, storedAmount, `USD deposit via NowPayments (${cryptoCoin || 'crypto'} paid)`]
      );

      await client.query('COMMIT');
      credited = true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    if (credited) {
      invalidateCache('/api/payments/balance');
      logger.info({ userId, amount: storedAmount, orderId }, 'Deposit confirmed');
    }
    res.json({ status: 'ok' });

  } catch (err) {
    logger.error({ err }, 'IPN webhook error');
    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      return res.status(503).json({ error: 'Payment webhook not configured (missing IPN secret)' });
    }
    // Non-2xx makes NowPayments retry — correct for transient DB failures.
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
    logger.error({ err }, 'Request failed');
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

    // Deduct USD atomically (amount + fee, sender pays fee).
    // The `available >= $1` guard makes check+debit a single statement, so two
    // concurrent withdrawals can never both succeed against the same balance.
    const deducted = await pool.query(
      `UPDATE user_coin_balances
          SET available = available - $1, total_spent = total_spent + $1
        WHERE user_id = $2 AND coin = 'USD' AND available >= $1
        RETURNING available`,
      [totalDeduction, userId]
    );

    if (deducted.rows.length === 0) {
      const balanceResult = await pool.query(
        "SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
        [userId]
      );
      const available = parseFloat(balanceResult.rows[0]?.available || 0);
      return res.status(400).json({
        error: `Insufficient balance. Need $${totalDeduction.toFixed(2)} ($${amount.toFixed(2)} + $${fee.toFixed(2)} fee), have $${available.toFixed(2)}`
      });
    }

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
    logger.error({ err }, 'Request failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/history — USD transactions
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    // Whitelist the limit: raw query values go straight into LIMIT $2.
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

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
    logger.error({ err }, 'Request failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/deduct — internal deduct (for chat payments) — USD only
router.post('/deduct', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = parseFloat(req.body.amount);

    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount required' });
    }

    // Single atomic statement: a read-then-write pair lets two parallel
    // requests both pass the balance check and overspend the wallet.
    const result = await pool.query(
      `UPDATE user_coin_balances
          SET available = available - $1, total_spent = total_spent + $1
        WHERE user_id = $2 AND coin = 'USD' AND available >= $1
        RETURNING available`,
      [amount, userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    res.json({ success: true, message: `Deducted $${amount.toFixed(4)} USD` });

  } catch (err) {
    logger.error({ err }, 'Request failed');
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
