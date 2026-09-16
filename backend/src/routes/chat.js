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

// Free Cloud AI — Round-robin providers
let roundRobinIndex = 0;
const FREE_PROVIDERS = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    models: { 'llama3.1:8b': 'llama-3.1-8b-instant', 'llama3.3:70b': 'llama-3.3-70b-versatile', 'qwen3.6:27b': 'qwen/qwen3.6-27b', 'free-cloud-ai': 'llama-3.1-8b-instant' },
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
    const minerResult = wsServer ? wsServer.findMinerForModel(model) : null;
    const minerId = minerResult ? minerResult.minerId : null;
    const minerModel = minerResult ? minerResult.model : null;

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status, session_id)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [userId, minerId, message, model || 'llama3:8b', sessionId]
    );

    const taskId = taskResult.rows[0].id;
    let response, tokensUsed, cost, providerUsed = null;

    // Try WebSocket dispatch first — use miner's available model
    if (wsServer && minerId && minerModel) {
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [minerId, taskId]);

        console.log(`Dispatching task to miner ${minerId} with model ${minerModel} (requested: ${model})`);
        const result = await wsServer.dispatchTask(minerId, taskId, message, minerModel);

        if (result.error) {
          console.log(`Miner task failed: ${result.error}, falling back to local Ollama`);
        } else {
          response = result.response;
          tokensUsed = result.tokens_used || 0;
          const pricing = getModelPricing(model || 'llama3.1:8b');
          cost = (tokensUsed * pricing.outputPrice) / 1000000;
        }

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
        }, { timeout: 30000 });

        response = ollamaResponse.data.response;
        tokensUsed = ollamaResponse.data.eval_count || 0;
        const pricing = getModelPricing(model || 'llama3.1:8b');
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
              const pricing = getModelPricing(model || 'llama3.1:8b');
              cost = 0;
              console.log(`Free Cloud AI: used ${provider.name} for model "${model}"`);
              break;
            }
          } catch (providerError) {
            externalError = providerError;
            // Rate limit → cooldown
            if (providerError.response?.status === 429) {
              provider.cooldownUntil = Date.now() + 60000;
              console.log(`${provider.name} rate limited, cooldown 60s`);
            }
            continue;
          }
        }

        if (!response) {
          await pool.query(
            "UPDATE tasks SET response = 'No providers available', status = 'failed' WHERE id = $1",
            [taskId]
          );
          return res.status(503).json({
            error: 'No miners or free providers available. Please try again later.',
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
      source: minerId ? 'miner' : providerUsed ? 'external' : 'local',
      provider_name: providerUsed,
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
