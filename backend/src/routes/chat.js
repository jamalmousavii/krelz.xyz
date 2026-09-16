const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');
const { invalidateCache } = require('../cache');
const { authenticate, optionalAuth } = require('../middleware/auth');
const MODELS = require('../models');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const SUPPORTED_COINS = ['BTC', 'ETH', 'BNB', 'USDT', 'TRX', 'DOGE', 'XRP'];
const DAILY_TOKEN_LIMIT = 1000;

const getModelPricing = (modelId) => {
  const found = MODELS.find(m => m.id === modelId);
  return found ? { inputPrice: found.inputPrice, outputPrice: found.outputPrice } : { inputPrice: 0.088, outputPrice: 0.176 };
};

const checkDailyTokens = async (userId) => {
  if (!userId) return { limit: 0, used: 0, remaining: 0 };

  const today = new Date().toISOString().split('T')[0];

  const result = await pool.query(
    'SELECT tokens_used_today, last_reset_date FROM daily_tokens WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    await pool.query(
      'INSERT INTO daily_tokens (user_id, tokens_used_today, last_reset_date) VALUES ($1, 0, $2) ON CONFLICT (user_id) DO NOTHING',
      [userId, today]
    );
    return { limit: DAILY_TOKEN_LIMIT, used: 0, remaining: DAILY_TOKEN_LIMIT };
  }

  const { tokens_used_today, last_reset_date } = result.rows[0];

  if (last_reset_date !== today) {
    await pool.query(
      'UPDATE daily_tokens SET tokens_used_today = 0, last_reset_date = $1 WHERE user_id = $2',
      [today, userId]
    );
    return { limit: DAILY_TOKEN_LIMIT, used: 0, remaining: DAILY_TOKEN_LIMIT };
  }

  const used = parseFloat(tokens_used_today);
  const remaining = Math.max(0, DAILY_TOKEN_LIMIT - used);
  return { limit: DAILY_TOKEN_LIMIT, used, remaining };
};

// ======== SESSION CRUD ========

// GET /api/chat/sessions — list user sessions
router.get('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT cs.*,
              COUNT(t.id) FILTER (WHERE t.id IS NOT NULL) AS message_count,
              MAX(t.created_at) AS last_message_at
       FROM chat_sessions cs
       LEFT JOIN tasks t ON t.session_id = cs.id
       WHERE cs.user_id = $1
       GROUP BY cs.id
       ORDER BY COALESCE(MAX(t.created_at), cs.updated_at) DESC`,
      [userId]
    );

    res.json({ success: true, sessions: result.rows });
  } catch (err) {
    console.error('Sessions list error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chat/sessions/:id — get session messages
router.get('/sessions/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id);

    const sessionResult = await pool.query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messagesResult = await pool.query(
      `SELECT prompt AS content, 'user' AS role, created_at
       FROM tasks WHERE session_id = $1 AND user_id = $2
       UNION ALL
       SELECT response AS content, 'assistant' AS role, completed_at AS created_at
       FROM tasks WHERE session_id = $1 AND user_id = $2 AND response IS NOT NULL
       ORDER BY created_at ASC`,
      [sessionId, userId]
    );

    res.json({
      success: true,
      session: sessionResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (err) {
    console.error('Session get error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chat/sessions — create new session
router.post('/sessions', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, model } = req.body;

    const result = await pool.query(
      `INSERT INTO chat_sessions (user_id, subject, model)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, subject || 'New Chat', model || null]
    );

    res.status(201).json({ success: true, session: result.rows[0] });
  } catch (err) {
    console.error('Session create error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/chat/sessions/:id — update subject
router.put('/sessions/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id);
    const { subject } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    const result = await pool.query(
      `UPDATE chat_sessions
       SET subject = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [subject.trim(), sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true, session: result.rows[0] });
  } catch (err) {
    console.error('Session update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/chat/sessions/:id — delete session + messages
router.delete('/sessions/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parseInt(req.params.id);

    const sessionResult = await pool.query(
      'SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await pool.query('DELETE FROM tasks WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);

    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('Session delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ======== CHAT (with session support) ========

// POST /api/chat — send message (supports session_id)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { message, model, coin, session_id } = req.body;
    const userId = req.user?.id;
    const paymentCoin = (coin || 'USDT').toUpperCase();

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Resolve or create session
    let sessionId = session_id || null;

    if (userId) {
      if (sessionId) {
        // Verify session belongs to user
        const check = await pool.query(
          'SELECT id FROM chat_sessions WHERE id = $1 AND user_id = $2',
          [sessionId, userId]
        );
        if (check.rows.length === 0) {
          sessionId = null; // invalid session, will create new one
        }
      }

      if (!sessionId) {
        // Create new session with auto-generated subject
        const subject = message.length > 50 ? message.substring(0, 50) + '...' : message;
        const sessionResult = await pool.query(
          `INSERT INTO chat_sessions (user_id, subject, model)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [userId, subject, model || 'llama3:8b']
        );
        sessionId = sessionResult.rows[0].id;
      }
    }

    const wsServer = req.app.get('wsServer');
    const minerId = wsServer ? wsServer.findMinerForModel(model) : null;

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status, session_id)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userId, minerId, message, model || 'llama3:8b', sessionId]
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
        const pricing = getModelPricing(model || 'llama3.1:8b');
        cost = (tokensUsed * pricing.outputPrice) / 1000000;

      } catch (wsError) {
        console.log(`WebSocket dispatch failed: ${wsError.message}, falling back to local Ollama`);
      }
    }

    // Fallback: local Ollama
    if (!response) {
      try {
        let ollamaModel = model || 'llama3:8b';

        // Smart fallback: check available models
        try {
          const tagsRes = await axios.get(`${OLLAMA_URL}/api/tags`);
          const available = tagsRes.data.models.map(m => m.name);
          if (!available.includes(ollamaModel)) {
            const exactMatch = available.find(m => m.startsWith(ollamaModel.split(':')[0]));
            ollamaModel = exactMatch || available[0] || ollamaModel;
            console.log(`Model "${model}" not available locally, using "${ollamaModel}"`);
          }
        } catch (tagErr) {
          console.log('Could not list Ollama models, trying requested model');
        }

        const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: ollamaModel,
          prompt: message,
          stream: false
        });

        response = ollamaResponse.data.response;
        tokensUsed = ollamaResponse.data.eval_count || 0;
        const pricing = getModelPricing(model || 'llama3.1:8b');
        cost = (tokensUsed * pricing.outputPrice) / 1000000;

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

    // Payment: daily tokens + user coin balance
    let paymentStatus = 'free';
    let dailyTokensInfo = { limit: DAILY_TOKEN_LIMIT, used: 0, remaining: DAILY_TOKEN_LIMIT };

    if (userId && cost > 0) {
      const dailyInfo = await checkDailyTokens(userId);
      dailyTokensInfo = dailyInfo;

      const dailyTokenValue = dailyInfo.remaining * 0.001;
      const dailyCoverage = Math.min(cost, dailyTokenValue);
      const paidPortion = cost - dailyCoverage;

      if (dailyCoverage > 0) {
        const tokensToDeduct = dailyCoverage / 0.001;
        await pool.query(
          'UPDATE daily_tokens SET tokens_used_today = tokens_used_today + $1 WHERE user_id = $2',
          [tokensToDeduct, userId]
        );
        dailyTokensInfo = { ...dailyTokensInfo, used: dailyInfo.used + tokensToDeduct, remaining: Math.max(0, dailyInfo.remaining - tokensToDeduct) };
      }

      if (paidPortion > 0 && SUPPORTED_COINS.includes(paymentCoin)) {
        const balanceResult = await pool.query(
          'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2',
          [userId, paymentCoin]
        );
        const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

        if (userBalance >= paidPortion) {
          await pool.query(
            `UPDATE user_coin_balances
             SET available = available - $1, total_spent = total_spent + $1
             WHERE user_id = $2 AND coin = $3`,
            [paidPortion, userId, paymentCoin]
          );

          const minerEarning = paidPortion * 0.9;
          if (minerId) {
            await pool.query(
              'UPDATE miners SET total_tasks = total_tasks + 1, earnings = earnings + $1 WHERE id = $2',
              [minerEarning, minerId]
            );
            await pool.query(
              `INSERT INTO miner_coin_earnings (miner_id, coin, amount, task_id)
               VALUES ($1, $2, $3, $4)`,
              [minerId, paymentCoin, minerEarning, taskId]
            );
          }
          paymentStatus = 'paid';
          invalidateCache('/api/payments/balance');
        } else {
          paymentStatus = 'insufficient_balance';
        }
      } else if (paidPortion <= 0) {
        paymentStatus = 'free_daily';
      }
    }

    res.json({
      success: true,
      response,
      task_id: taskId,
      session_id: sessionId,
      tokens_used: tokensUsed,
      cost,
      coin: paymentCoin,
      payment_status: paymentStatus,
      miner_id: minerId,
      source: minerId ? 'miner' : 'local',
      daily_tokens: dailyTokensInfo
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chat/history — legacy endpoint (backward compatibility)
router.get('/history', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    res.json({ success: true, tasks: result.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
