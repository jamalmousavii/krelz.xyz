const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');
const { invalidateCache } = require('../cache');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const SUPPORTED_COINS = ['BTC', 'ETH', 'BNB', 'USDT', 'TRX', 'DOGE', 'XRP'];

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, model, coin } = req.body;
    const userId = req.user?.id;
    const paymentCoin = (coin || 'USDT').toUpperCase();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const wsServer = req.app.get('wsServer');
    const minerId = wsServer ? wsServer.findMinerForModel(model) : null;

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [userId, minerId, message, model || 'llama3:8b']
    );

    const taskId = taskResult.rows[0].id;
    let response, tokensUsed, cost;

    // Try WebSocket dispatch first
    if (wsServer && minerId) {
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [minerId, taskId]);

        const result = await wsServer.dispatchTask(minerId, taskId, message, model);

        if (result.error) {
          await pool.query("UPDATE tasks SET response = $1, status = 'failed' WHERE id = $2", [result.error, taskId]);
          return res.status(500).json({ error: result.error, task_id: taskId });
        }

        response = result.response;
        tokensUsed = result.tokens_used || 0;
        cost = tokensUsed * 0.001;

      } catch (wsError) {
        console.log(`WebSocket dispatch failed: ${wsError.message}, falling back to local Ollama`);
      }
    }

    // Fallback: local Ollama
    if (!response) {
      try {
        const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: model || 'llama3:8b',
          prompt: message,
          stream: false
        });

        response = ollamaResponse.data.response;
        tokensUsed = ollamaResponse.data.eval_count || 0;
        cost = tokensUsed * 0.001;

      } catch (ollamaError) {
        await pool.query(
          "UPDATE tasks SET response = 'No miners or Ollama available', status = 'failed' WHERE id = $1",
          [taskId]
        );
        return res.status(503).json({
          error: 'No miners available for this model. Please try again later.',
          task_id: taskId
        });
      }
    }

    // Update task with result
    await pool.query(
      `UPDATE tasks
       SET response = $1, tokens_used = $2, cost = $3, status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [response, tokensUsed, cost, taskId]
    );

    // Payment: deduct from user's coin balance
    let paymentStatus = 'free';
    if (userId && SUPPORTED_COINS.includes(paymentCoin)) {
      const balanceResult = await pool.query(
        'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2',
        [userId, paymentCoin]
      );

      const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

      if (userBalance >= cost && cost > 0) {
        // Deduct from user
        await pool.query(
          `UPDATE user_coin_balances
           SET available = available - $1, total_spent = total_spent + $1
           WHERE user_id = $2 AND coin = $3`,
          [cost, userId, paymentCoin]
        );

        // 90% to miner, 10% platform
        const minerEarning = cost * 0.9;

        if (minerId) {
          await pool.query(
            'UPDATE miners SET total_tasks = total_tasks + 1, earnings = earnings + $1 WHERE id = $2',
            [minerEarning, minerId]
          );

          // Track miner earning per coin
          await pool.query(
            `INSERT INTO miner_coin_earnings (miner_id, coin, amount, task_id)
             VALUES ($1, $2, $3, $4)`,
            [minerId, paymentCoin, minerEarning, taskId]
          );
        }

        paymentStatus = 'paid';
        invalidateCache('/api/payments/balance');
      } else if (cost > 0) {
        paymentStatus = 'insufficient_balance';
      }
    }

    res.json({
      success: true,
      response,
      task_id: taskId,
      tokens_used: tokensUsed,
      cost,
      coin: paymentCoin,
      payment_status: paymentStatus,
      miner_id: minerId,
      source: minerId ? 'miner' : 'local'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chat/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.json({
      success: true,
      tasks: result.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
