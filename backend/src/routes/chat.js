const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');
const { invalidateCache } = require('../cache');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, chatRules } = require('../middleware/validate');
const MODELS = require('../models');
const { logger } = require('../logger');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const SUPPORTED_COINS = ['USD'];
const DAILY_TOKEN_LIMIT = 1000;
// Single source of truth for the default model (was split between
// 'llama3:8b' — which exists in no catalog — and 'llama3.1:8b').
const DEFAULT_MODEL = 'llama3.1:8b';
const FREE_DAILY_TOKEN_VALUE = 0.001; // $1 of free credit == 1000 tokens
const MINER_REVENUE_SHARE = 0.9;

// Free Cloud AI — Round-robin providers
let roundRobinIndex = 0;
const FREE_PROVIDERS = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    models: { 'llama3.1:8b': 'llama-3.1-8b-instant', 'llama3.3:70b': 'llama-3.3-70b-versatile', 'free-cloud-ai': 'llama-3.1-8b-instant' },
    cooldownUntil: 0
  },
  {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    models: { 'llama3.1:8b': 'meta-llama/llama-3.1-8b-instruct:free', 'deepseek-r1:70b': 'deepseek/deepseek-r1:free', 'free-cloud-ai': 'meta-llama/llama-3.1-8b-instruct:free' },
    cooldownUntil: 0
  },
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: process.env.CEREBRAS_API_KEY,
    models: { 'llama3.1:8b': 'llama-3.1-8b', 'llama3.3:70b': 'llama-3.3-70b', 'free-cloud-ai': 'llama-3.1-8b' },
    cooldownUntil: 0
  },
  {
    name: 'Cloudflare',
    url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
    key: process.env.CLOUDFLARE_API_TOKEN,
    models: { 'llama3.1:8b': '@cf/meta/llama-3.1-8b-instruct', 'llama3.3:70b': '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'free-cloud-ai': '@cf/meta/llama-3.1-8b-instruct' },
    cooldownUntil: 0
  }
];

function getNextProvider() {
  const start = roundRobinIndex;
  const now = Date.now();
  do {
    const provider = FREE_PROVIDERS[roundRobinIndex];
    roundRobinIndex = (roundRobinIndex + 1) % FREE_PROVIDERS.length;
    if (provider.key && (!provider.cooldownUntil || now > provider.cooldownUntil)) {
      return provider;
    }
  } while (roundRobinIndex !== start);
  return null;
}

async function callExternalProvider(provider, model, message) {
  const mappedModel = provider.models[model] || provider.models['free-cloud-ai'];
  if (!mappedModel) return null;

  const isCloudflare = provider.name === 'Cloudflare';

  const headers = { 'Content-Type': 'application/json' };
  if (isCloudflare) {
    headers['Authorization'] = `Bearer ${provider.key}`;
  } else {
    headers['Authorization'] = `Bearer ${provider.key}`;
  }

  const body = isCloudflare
    ? { messages: [{ role: 'user', content: message }], stream: false }
    : { model: mappedModel, messages: [{ role: 'user', content: message }], stream: false };

  const res = await axios.post(provider.url, body, { headers, timeout: 30000 });
  const data = res.data;

  if (isCloudflare) {
    return data.result?.response || null;
  }
  return data.choices?.[0]?.message?.content || null;
}

const getModelPricing = (modelId) => {
  const found = MODELS.find(m => m.id === modelId);
  return found ? { inputPrice: found.inputPrice, outputPrice: found.outputPrice } : { inputPrice: 0.088, outputPrice: 0.176 };
};

// Date helpers — daily_tokens.last_reset_date must be compared as 'YYYY-MM-DD'.
// BOTH sides use the server's local calendar (the VPS runs UTC). A pg DATE
// column comes back either as 'YYYY-MM-DD' (string, see database/pool.js) or as
// a Date pinned to LOCAL midnight; converting that with toISOString() shifted
// the date back one day in any UTC+n zone and made the allowance reset on
// every single request. Never mix the two bases here.
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toDateKey = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).slice(0, 10);
};

// Cheap pre-flight: does this user have ANY way to pay for a paid model?
async function hasSpendableAllowance(userId) {
  const today = todayKey();
  const daily = await pool.query(
    'SELECT tokens_used_today, last_reset_date FROM daily_tokens WHERE user_id = $1',
    [userId]
  );

  if (daily.rows.length > 0) {
    const used = parseFloat(daily.rows[0].tokens_used_today || 0);
    const lastReset = toDateKey(daily.rows[0].last_reset_date);
    if (lastReset === today && used < DAILY_TOKEN_LIMIT) return true;
    if (lastReset !== today) return true; // allowance resets today
  } else {
    return true; // fresh row → full allowance
  }

  const balance = await pool.query(
    "SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
    [userId]
  );
  return parseFloat(balance.rows[0]?.available || 0) > 0;
}

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
    logger.error({ err }, 'Sessions list failed');
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
    logger.error({ err }, 'Session get failed');
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
      [userId, String(subject || 'New Chat').slice(0, 255), model ? String(model).slice(0, 100) : null]
    );

    res.status(201).json({ success: true, session: result.rows[0] });
  } catch (err) {
    logger.error({ err }, 'Session create failed');
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
    if (subject.trim().length > 255) {
      return res.status(400).json({ error: 'Subject must be at most 255 characters' });
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
    logger.error({ err }, 'Session update failed');
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
    logger.error({ err }, 'Session delete failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// ======== CHAT (with session support) ========

// POST /api/chat — send message (supports session_id)
router.post('/', optionalAuth, chatRules, validate, async (req, res) => {
  try {
    const { message, model, session_id } = req.body;
    const userId = req.user?.id;
    const paymentCoin = 'USD';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Pre-flight for paid models: don't burn GPU time for a user who has
    // neither daily allowance nor wallet balance. free-cloud-ai stays free.
    const requestedPricing = getModelPricing(model || DEFAULT_MODEL);
    if (userId && requestedPricing.outputPrice > 0) {
      const canPay = await hasSpendableAllowance(userId);
      if (!canPay) {
        return res.status(402).json({
          error: 'Daily free allowance exhausted and wallet balance is empty. Top up to keep chatting.',
          payment_status: 'insufficient_balance',
        });
      }
    }

    // Resolve or create session
    let sessionId = session_id ? parseInt(session_id, 10) : null;
    if (sessionId !== null && Number.isNaN(sessionId)) sessionId = null;

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
        const subject = (message.length > 50 ? message.substring(0, 50) + '...' : message).slice(0, 255);
        const sessionResult = await pool.query(
          `INSERT INTO chat_sessions (user_id, subject, model)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [userId, subject, model || DEFAULT_MODEL]
        );
        sessionId = sessionResult.rows[0].id;
      }
    }

    const wsServer = req.app.get('wsServer');
    const minerResult = wsServer ? wsServer.findMinerForModel(model) : null;
    const minerId = minerResult ? minerResult.minerId : null;
    const minerModel = minerResult && minerResult.model ? minerResult.model : (model || DEFAULT_MODEL);

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status, session_id)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userId, minerId, message, model || DEFAULT_MODEL, sessionId]
    );

    const taskId = taskResult.rows[0].id;
    let response, tokensUsed, cost, providerUsed = null;
    let lastMinerError = null;
    let servedByMiner = false;

    // Try WebSocket dispatch first — use miner's available model
    if (wsServer && minerId && minerModel) {
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [minerId, taskId]);

        logger.debug({ taskId, minerId, minerModel, requestedModel: model }, 'Dispatching task to miner');
        const result = await wsServer.dispatchTask(minerId, taskId, message, minerModel);

        if (result.error) {
          logger.warn({ taskId, minerId, err: result.error }, 'Miner task failed, falling back');
          lastMinerError = result.error;
        } else {
          response = result.response;
          tokensUsed = result.tokens_used || 0;
          servedByMiner = true;
          const pricing = getModelPricing(model || DEFAULT_MODEL);
          cost = (tokensUsed * pricing.outputPrice) / 1000000;
        }

      } catch (wsError) {
        logger.warn({ taskId, err: wsError.message }, 'WebSocket dispatch failed, falling back');
        lastMinerError = wsError.message;
      }
    }

    // Fallback: local Ollama
    if (!response) {
      try {
        let ollamaModel = model || DEFAULT_MODEL;

        // Smart fallback: check available models
        try {
          const tagsRes = await axios.get(`${OLLAMA_URL}/api/tags`);
          const available = (tagsRes.data.models || []).map(m => m.name);
          if (available.length === 0) {
            throw new Error('No local Ollama models');
          }
          if (!available.includes(ollamaModel)) {
            const family = ollamaModel.split(':')[0];
            const exactMatch = available.find(m => m.startsWith(family + ':') || m === family);
            ollamaModel = exactMatch || available.find(m => m.includes('8b')) || available[0];
            logger.warn({ requested: model, using: ollamaModel }, 'Requested model not available locally');
          }
        } catch (tagErr) {
          // No models / can't list → skip to cloud providers
          throw new Error('Ollama unavailable');
        }

        const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
          model: ollamaModel,
          prompt: message,
          stream: false
        }, { timeout: 30000 });

        response = ollamaResponse.data.response;
        tokensUsed = ollamaResponse.data.eval_count || 0;
        const pricing = getModelPricing(model || DEFAULT_MODEL);
        cost = (tokensUsed * pricing.outputPrice) / 1000000;

      } catch (ollamaError) {
        // Fallback: try free external providers (round-robin)
        let externalError = null;
        for (let i = 0; i < FREE_PROVIDERS.length; i++) {
          const provider = getNextProvider();
          if (!provider) break;

          try {
            const externalResponse = await callExternalProvider(provider, model, message);
            if (externalResponse) {
              response = externalResponse;
              providerUsed = provider.name;
              tokensUsed = 0;
              const pricing = getModelPricing(model || DEFAULT_MODEL);
              cost = 0;
              logger.info({ provider: provider.name, model }, 'Free Cloud AI used');
              break;
            }
          } catch (providerError) {
            externalError = providerError;
            // Rate limit → cooldown
            if (providerError.response?.status === 429) {
              provider.cooldownUntil = Date.now() + 60000;
              logger.warn({ provider: provider.name }, 'Provider rate limited, cooldown 60s');
            }
            continue;
          }
        }

        if (!response) {
          await pool.query(
            "UPDATE tasks SET response = 'No providers available', status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $1",
            [taskId]
          );
          const detail = lastMinerError
            ? ` (miner: ${lastMinerError})`
            : '';
          const noKeys = !FREE_PROVIDERS.some(p => p.key);
          return res.status(503).json({
            error: noKeys
              ? `No inference source available. Local models unavailable and free AI API keys not configured.${detail}`
              : `No miners or free providers available. Please try again later.${detail}`,
            task_id: taskId
          });
        }
      }
    }

    // Update task with result
    await pool.query(
      `UPDATE tasks
       SET response = $1, tokens_used = $2, cost = $3, status = 'completed', completed_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [response, tokensUsed, cost, taskId]
    );

    // Miner throughput counter. Revenue is accounted for separately below so a
    // free/daily-covered task still counts as completed work for the miner.
    if (servedByMiner && minerId) {
      await pool.query('UPDATE miners SET total_tasks = total_tasks + 1 WHERE id = $1', [minerId])
        .catch((err) => logger.error({ err, minerId }, 'Failed to increment miner total_tasks'));
    }

    // Payment: daily free allowance first, then the USD wallet.
    // Everything happens in ONE transaction with row locks so two parallel
    // requests can't both spend the same balance or the same daily allowance.
    let paymentStatus = 'free';
    let dailyTokensInfo = { limit: DAILY_TOKEN_LIMIT, used: 0, remaining: DAILY_TOKEN_LIMIT };
    let insufficientBalance = false;

    if (userId && cost > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const today = todayKey();
        await client.query(
          `INSERT INTO daily_tokens (user_id, tokens_used_today, last_reset_date)
           VALUES ($1, 0, $2)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, today]
        );

        const dailyLock = await client.query(
          'SELECT tokens_used_today, last_reset_date FROM daily_tokens WHERE user_id = $1 FOR UPDATE',
          [userId]
        );

        let used = parseFloat(dailyLock.rows[0]?.tokens_used_today || 0);
        if (toDateKey(dailyLock.rows[0]?.last_reset_date) !== today) {
          used = 0;
          await client.query(
            'UPDATE daily_tokens SET tokens_used_today = 0, last_reset_date = $1 WHERE user_id = $2',
            [today, userId]
          );
        }

        let remaining = Math.max(0, DAILY_TOKEN_LIMIT - used);
        dailyTokensInfo = { limit: DAILY_TOKEN_LIMIT, used, remaining };

        const dailyCoverage = Math.min(cost, remaining * FREE_DAILY_TOKEN_VALUE);
        const paidPortion = cost - dailyCoverage;

        if (dailyCoverage > 0) {
          const tokensToDeduct = dailyCoverage / FREE_DAILY_TOKEN_VALUE;
          await client.query(
            'UPDATE daily_tokens SET tokens_used_today = tokens_used_today + $1 WHERE user_id = $2',
            [tokensToDeduct, userId]
          );
          used += tokensToDeduct;
          remaining = Math.max(0, remaining - tokensToDeduct);
          dailyTokensInfo = { limit: DAILY_TOKEN_LIMIT, used, remaining };
        }

        if (paidPortion > 0 && SUPPORTED_COINS.includes(paymentCoin)) {
          const balanceResult = await client.query(
            'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2 FOR UPDATE',
            [userId, paymentCoin]
          );
          const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

          if (userBalance >= paidPortion) {
            await client.query(
              `UPDATE user_coin_balances
                  SET available = available - $1, total_spent = total_spent + $1
                WHERE user_id = $2 AND coin = $3`,
              [paidPortion, userId, paymentCoin]
            );

            // Only a miner that actually served the task earns — a cloud/Ollama
            // fallback must never credit earnings to the miner of record.
            if (minerId && servedByMiner) {
              const minerEarning = paidPortion * MINER_REVENUE_SHARE;
              await client.query(
                'UPDATE miners SET earnings = earnings + $1 WHERE id = $2',
                [minerEarning, minerId]
              );
              await client.query(
                `INSERT INTO miner_coin_earnings (miner_id, coin, amount, task_id)
                 VALUES ($1, $2, $3, $4)`,
                [minerId, paymentCoin, minerEarning, taskId]
              );
            }
            paymentStatus = 'paid';
          } else {
            paymentStatus = 'insufficient_balance';
            insufficientBalance = true;
          }
        } else if (paidPortion <= 0) {
          paymentStatus = 'free_daily';
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      if (paymentStatus === 'paid') invalidateCache('/api/payments/balance');
    }

    // Daily allowance exhausted and wallet empty: refuse instead of serving
    // paid inference for free. The answer is already stored in `tasks`.
    if (insufficientBalance) {
      return res.status(402).json({
        error: 'Insufficient balance. Top up your wallet, or wait for the daily free allowance to reset.',
        payment_status: 'insufficient_balance',
        cost,
        daily_tokens: dailyTokensInfo,
        task_id: taskId
      });
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
      miner_id: servedByMiner ? minerId : null,
      source: servedByMiner ? 'miner' : providerUsed ? 'external' : 'local',
      provider_name: providerUsed,
      daily_tokens: dailyTokensInfo
    });

  } catch (err) {
    logger.error({ err }, 'POST /api/chat failed');
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
    logger.error({ err }, 'Request failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// Exposed for the test suite (pricing + date-key rules are money-adjacent).
router.getModelPricing = getModelPricing;
router.todayKey = todayKey;
router.toDateKey = toDateKey;
router.DEFAULT_MODEL = DEFAULT_MODEL;
router.MINER_REVENUE_SHARE = MINER_REVENUE_SHARE;
router.FREE_DAILY_TOKEN_VALUE = FREE_DAILY_TOKEN_VALUE;

module.exports = router;
