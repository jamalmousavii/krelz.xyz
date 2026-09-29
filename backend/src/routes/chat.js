const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');
const { invalidateCache } = require('../cache');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { validate, chatRules } = require('../middleware/validate');
const MODELS = require('../models');
const { logger } = require('../logger');
const { prepareAttachment, AttachmentError } = require('../services/attachments');
const { chargeMinerCredit, getMinerCreditStatus } = require('../services/minerCredit');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Single source of truth for the default model (was split between
// 'llama3:8b' — which exists in no catalog — and 'llama3.1:8b').
const DEFAULT_MODEL = 'llama3.1:8b';
const MINER_REVENUE_SHARE = 0.9;

const getModelPricing = (modelId) => {
  const found = MODELS.find(m => m.id === modelId);
  return found ? { inputPrice: found.inputPrice, outputPrice: found.outputPrice } : { inputPrice: 0.088, outputPrice: 0.176 };
};

// Cheap pre-flight: is there any USD balance to charge a paid model against?
// (The daily free allowance was removed in v3.24.0 — wallet only.)
async function hasWalletFunds(userId) {
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
      `SELECT prompt AS content, 'user' AS role, created_at, media
       FROM tasks WHERE session_id = $1 AND user_id = $2
       UNION ALL
       SELECT response AS content, 'assistant' AS role, completed_at AS created_at, NULL::jsonb AS media
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
    const { message: rawMessage, model, session_id, attachment } = req.body;
    // Image-only / voice-only sends arrive with an empty message (the
    // validator allows that exactly when an attachment is present).
    const message = typeof rawMessage === 'string' ? rawMessage : '';
    const userId = req.user?.id;
    const paymentCoin = 'USD';

    if (!message.trim() && !attachment) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Capability gate: images need a vision model, voice notes an audio-capable
    // one. Reject up front so the UI can explain exactly why — the attachment
    // must never be silently dropped.
    const requestedModel = model || DEFAULT_MODEL;
    const caps = MODELS.find(m => m.id === requestedModel);
    if (attachment && attachment.type === 'image' && !(caps && caps.vision)) {
      return res.status(400).json({
        error: `Model ${requestedModel} cannot read images. Pick a vision-capable model or remove the image.`,
        code: 'ATTACHMENT_UNSUPPORTED',
      });
    }
    if (attachment && attachment.type === 'audio' && !(caps && caps.audio)) {
      return res.status(400).json({
        error: `Model ${requestedModel} cannot process voice notes. Pick an audio-capable model or record again.`,
        code: 'ATTACHMENT_UNSUPPORTED',
      });
    }

    // Normalize the attachment before anything is persisted or dispatched:
    // images/audio pass through as Ollama media, files are parsed to text and
    // prepended to the prompt (so any chat model can answer them).
    let effectiveMessage = message;
    let media = null;
    let dbAttachment = null;
    if (attachment) {
      try {
        ({ effectiveMessage, media, dbAttachment } = await prepareAttachment(attachment, message));
      } catch (err) {
        if (err instanceof AttachmentError) {
          return res.status(400).json({ error: err.message, code: err.code });
        }
        logger.error({ err }, 'Attachment preparation failed');
        return res.status(400).json({ error: 'Could not process attachment', code: 'ATTACHMENT_INVALID' });
      }
    }

    // Pre-flight for paid models: don't burn inference time for a user who
    // can pay neither way. Signed-in users can pay from the wallet or from
    // the free miner credit (v3.25.0); guests are exempt — they chat free.
    const requestedPricing = getModelPricing(model || DEFAULT_MODEL);
    if (userId && requestedPricing.outputPrice > 0) {
      const canPay = await hasWalletFunds(userId);
      if (!canPay) {
        const credit = await getMinerCreditStatus(userId);
        if (!credit.eligible || credit.remaining <= 0) {
          return res.status(402).json({
            error: 'Wallet balance is empty. Top up to keep chatting, or keep a miner online for free daily credit.',
            payment_status: 'insufficient_balance',
          });
        }
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
        // Create new session with auto-generated subject. Attachment-only
        // messages have no text — name the session after the file instead.
        const subjectSource = message || (attachment && attachment.name) || 'New Chat';
        const subject = (subjectSource.length > 50 ? subjectSource.substring(0, 50) + '...' : subjectSource).slice(0, 255);
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
    // Media (image/audio) may only go to a miner new enough to understand the
    // `attachment` field on task messages (v3.20.0+).
    const minerResult = wsServer ? wsServer.findMinerForModel(requestedModel, !!media) : null;
    const minerId = minerResult ? minerResult.minerId : null;
    const minerModel = minerResult && minerResult.model ? minerResult.model : requestedModel;

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status, session_id, media, prepared_prompt)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
       RETURNING id`,
      [userId, minerId, message, requestedModel, sessionId, dbAttachment,
       effectiveMessage !== message ? effectiveMessage : null]
    );

    const taskId = taskResult.rows[0].id;
    let response, tokensUsed, cost;
    let lastMinerError = null;
    let servedByMiner = false;

    // Try WebSocket dispatch first — use miner's available model
    if (wsServer && minerId && minerModel) {
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [minerId, taskId]);

        logger.debug({ taskId, minerId, minerModel, requestedModel: model, media: !!media }, 'Dispatching task to miner');
        const result = await wsServer.dispatchTask(minerId, taskId, effectiveMessage, minerModel, media);

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
            if (media) {
              // Never substitute a random local model for a media request —
              // an image fed to a non-vision model returns garbage.
              throw new Error('Media model not available locally');
            }
            const family = ollamaModel.split(':')[0];
            const exactMatch = available.find(m => m.startsWith(family + ':') || m === family);
            ollamaModel = exactMatch || available.find(m => m.includes('8b')) || available[0];
            logger.warn({ requested: model, using: ollamaModel }, 'Requested model not available locally');
          }
        } catch (tagErr) {
          // No models / can't list → skip to cloud providers
          throw new Error('Ollama unavailable');
        }

        // Media goes through /api/chat with images[] — Ollama auto-detects
        // audio (WAV RIFF) in the same slot. Text stays on /api/generate.
        const ollamaResponse = media
          ? await axios.post(`${OLLAMA_URL}/api/chat`, {
              model: ollamaModel,
              messages: [{ role: 'user', content: effectiveMessage, images: [media.data] }],
              stream: false
            }, { timeout: 120000 })
          : await axios.post(`${OLLAMA_URL}/api/generate`, {
              model: ollamaModel,
              prompt: effectiveMessage,
              stream: false,
              // CPU inference on the VPS: cap output so one long reply can't
              // pin all cores for minutes.
              options: { num_predict: 768 }
            }, { timeout: 120000 });

        response = media
          ? (ollamaResponse.data.message && ollamaResponse.data.message.content)
          : ollamaResponse.data.response;
        tokensUsed = ollamaResponse.data.eval_count || 0;
        const pricing = getModelPricing(model || DEFAULT_MODEL);
        cost = (tokensUsed * pricing.outputPrice) / 1000000;

      } catch (ollamaError) {
        logger.warn({ err: ollamaError.message, model }, 'Local Ollama unavailable');

        if (media) {
          // Attachment was valid but no capable source existed — fail with a
          // stable code and keep the failure visible in history instead of
          // retrying forever or dropping the attachment.
          await pool.query(
            "UPDATE tasks SET response = 'No capable source for attachment', status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $1",
            [taskId]
          );
          return res.status(409).json({
            error: `No online miner or local model can handle this ${media.type === 'image' ? 'image' : 'voice note'} right now. Try again shortly or switch model.`,
            code: 'MEDIA_NO_MINER',
            task_id: taskId,
          });
        }
        await pool.query(
          "UPDATE tasks SET response = 'No inference source available', status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $1",
          [taskId]
        );
        const detail = lastMinerError
          ? ` (miner: ${lastMinerError})`
          : '';
        return res.status(503).json({
          error: `No inference source available. No miners are online and the local model is unreachable. Please try again later.${detail}`,
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

    // Miner throughput counter. Revenue is accounted for separately below, so
    // a guest (free) task still counts as completed work for the miner.
    if (servedByMiner && minerId) {
      await pool.query('UPDATE miners SET total_tasks = total_tasks + 1 WHERE id = $1', [minerId])
        .catch((err) => logger.error({ err, minerId }, 'Failed to increment miner total_tasks'));
    }

    // Payment: the signed-in user's USD wallet, in ONE transaction with a row
    // lock so two parallel requests can't spend the same balance. The free
    // miner credit (v3.25.0) is tried first inside the same transaction — it
    // is platform-funded, so no wallet debit and no miner revenue share (the
    // miner pool is only touched by paid chats). Guests (no userId) chat
    // free by design and never enter this block.
    let paymentStatus = 'free';
    let insufficientBalance = false;
    let minerCreditRemaining = null;

    if (userId && cost > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const creditCharge = await chargeMinerCredit(userId, cost, client);
        minerCreditRemaining = creditCharge.remaining;

        if (creditCharge.charged) {
          paymentStatus = 'free_miner';
        } else {
          const balanceResult = await client.query(
            'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2 FOR UPDATE',
            [userId, paymentCoin]
          );
          const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

          if (userBalance >= cost) {
            await client.query(
              `UPDATE user_coin_balances
                  SET available = available - $1, total_spent = total_spent + $1
                WHERE user_id = $2 AND coin = $3`,
              [cost, userId, paymentCoin]
            );

            // Only a miner that actually served the task earns — a local-Ollama
            // fallback must never credit earnings to the miner of record.
            if (minerId && servedByMiner) {
              const minerEarning = cost * MINER_REVENUE_SHARE;
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
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      if (paymentStatus === 'paid' || paymentStatus === 'free_miner') {
        invalidateCache('/api/payments/balance');
      }
    }

    // Wallet empty: refuse instead of serving paid inference for free. The
    // answer is already stored in `tasks`.
    if (insufficientBalance) {
      return res.status(402).json({
        error: 'Insufficient balance. Top up your wallet to keep chatting.',
        payment_status: 'insufficient_balance',
        cost,
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
      source: servedByMiner ? 'miner' : 'local',
      miner_credit_remaining: minerCreditRemaining
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

// Exposed for the test suite (pricing rules are money-adjacent).
router.getModelPricing = getModelPricing;
router.DEFAULT_MODEL = DEFAULT_MODEL;
router.MINER_REVENUE_SHARE = MINER_REVENUE_SHARE;

module.exports = router;
