const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const { invalidateCache } = require('../cache');
const { authenticate, strictIfHeader } = require('../middleware/auth');
const { validate, chatRules } = require('../middleware/validate');

// Miners control task_result.error, and that text is reflected into the 503
// below — strip control characters/markup and cap it so a hostile miner can't
// forge response content or log lines.
function sanitizeMinerDetail(raw) {
  return String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 80);
}
const MODELS = require('../models');
const { logger } = require('../logger');
const { prepareAttachment, AttachmentError } = require('../services/attachments');
const { chargeMinerCredit, getMinerCreditStatus } = require('../services/minerCredit');
const { getFreeStatus, chargeFreeTokens } = require('../services/freeAllowance');
const { getDailyCap, FREE_DAILY_TOKENS, TOKEN_BUNDLE, listPlans, getActivePlan } = require('../services/plans');
const { chargeTokenPot, getTokenBalance } = require('../services/tokenBundles');

// Single source of truth for the default model (was split between
// 'llama3:8b' — which exists in no catalog — and 'llama3.1:8b').
const DEFAULT_MODEL = 'llama3.1:8b';
const MINER_REVENUE_SHARE = 0.9;
// H1: hard per-task output-token bound. tokens_used comes from the miner (it
// both drives the user charge and the 90% miner share), so an inflated or
// NaN count must fail the task instead of minting money.
const MAX_TASK_TOKENS = 65536;

const getModelPricing = (modelId) => {
  const found = MODELS.find(m => m.id === modelId);
  return found ? { inputPrice: found.inputPrice, outputPrice: found.outputPrice } : { inputPrice: 0.088, outputPrice: 0.176 };
};

// Conversation window (v3.41.0): the last turns sent with every dispatch so
// miners can actually use context. Sliding window — newest first until the
// soft token budget, hard cap above that. Estimate ~4 chars/token.
const HISTORY_TURNS = 10;
const HISTORY_TOKENS = 6000;
const HISTORY_HARD_TOKENS = 16000;

async function buildHistory(sessionId) {
  if (!sessionId) return { history: [], truncated: false, tokens: 0 };
  const rows = await pool.query(
    `SELECT prompt, response FROM tasks
      WHERE session_id = $1 AND status = 'completed'
        AND response IS NOT NULL AND response <> ''
      ORDER BY id DESC LIMIT $2`,
    [sessionId, HISTORY_TURNS]
  );
  const history = [];
  let tokens = 0;
  let truncated = rows.rows.length === HISTORY_TURNS;
  for (const row of rows.rows) { // newest first: most relevant wins the budget
    const u = String(row.prompt || '');
    const a = String(row.response || '');
    const t = Math.ceil((u.length + a.length) / 4);
    if (t > HISTORY_HARD_TOKENS) { truncated = true; continue; } // single giant pair (e.g. file dump) never fits
    if (tokens + t > HISTORY_TOKENS) { truncated = true; break; }
    tokens += t;
    history.unshift({ role: 'user', content: u }, { role: 'assistant', content: a });
  }
  return { history, truncated, tokens };
}

// MODEL_UNAVAILABLE alternatives (v3.40.0): catalog models that have online
// miners right now, same category as the request first, then by miner count
// desc. Shape mirrors GET /api/models so the client can render directly.
function buildAlternatives(requestedModel, counts) {
  const requested = MODELS.find(m => m.id === requestedModel);
  const reqCat = requested ? requested.category : null;
  return MODELS
    .filter(m => (counts[m.id] || 0) > 0 && m.id !== requestedModel)
    .map(m => ({
      id: m.id, name: m.name, size: m.size, ram: m.ram,
      category: m.category, vision: m.vision, audio: m.audio,
      miners_online: counts[m.id],
    }))
    .sort((a, b) =>
      (((b.category === reqCat) ? 1 : 0) - ((a.category === reqCat) ? 1 : 0))
      || (b.miners_online - a.miners_online));
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
// F4: guests still work (no header), but a bad bearer → 401, never silent-guest.
router.post('/', strictIfHeader, chatRules, validate, async (req, res) => {
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

    // Coverage pre-flight (v3.27.0). v3.26 removed payment blocking entirely;
    // v3.27 brings back a *narrow* gate: a subject with NO coverage at all —
    // daily free allowance exhausted, no miner credit, empty token pot and
    // empty wallet — gets the upgrade wall (402 upgrade_required) instead of
    // a wasted dispatch. Anyone with a single unit of coverage is served
    // exactly as before. Failures here never block chat (availability first).
    const guestKey = userId ? null : (req.ip || null);
    let freeCap = FREE_DAILY_TOKENS;
    let preFlightFree = null;
    try {
      freeCap = await getDailyCap(userId);
      preFlightFree = await getFreeStatus({ userId, guestKey, cap: freeCap });
    } catch (err) {
      logger.error({ err }, 'Free allowance pre-flight failed (proceeding)');
    }

    if (preFlightFree && preFlightFree.remaining <= 0) {
      let covered = false;
      if (userId) {
        try {
          const credit = await getMinerCreditStatus(userId);
          covered = credit.eligible && credit.remaining > 0;
          if (!covered) {
            const pot = await getTokenBalance(userId);
            covered = pot > 0;
          }
          if (!covered) {
            const bal = await pool.query(
              "SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = 'USD'",
              [userId]
            );
            covered = parseFloat(bal.rows[0]?.available || 0) > 0;
          }
        } catch (err) {
          logger.error({ err }, 'Coverage check failed (proceeding)');
          covered = true;
        }
      }

      if (!covered) {
        return res.status(402).json({
          error: 'Daily free allowance exhausted and no funds left.',
          code: 'upgrade_required',
          free: { limit: freeCap, used: preFlightFree.used, remaining: 0 },
          plans: listPlans(),
          token_bundle: {
            price_per_million: TOKEN_BUNDLE.price_per_million,
            tokens_per_usd: TOKEN_BUNDLE.tokens_per_usd,
            min_usd: TOKEN_BUNDLE.min_usd,
            max_usd: TOKEN_BUNDLE.max_usd,
          },
          signed_in: !!userId,
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
    // v3.40.0 miner-only inference (exact-model rule): the user asked for THIS
    // model. Media (image/audio) may only go to a miner new enough to
    // understand the `attachment` field on task messages (v3.20.0+).
    // There is no local fallback anymore — an unservable request gets an
    // explicit, actionable error (MINER_OFFLINE / MODEL_UNAVAILABLE) instead
    // of a silently substituted reply. All three early returns below happen
    // BEFORE billing, so an unserved message never consumes allowance or
    // wallet.
    const needsMedia = !!media;

    // v3.41.0 conversation window: recent turns ride every dispatch so the
    // miner answers with context. Guests and fresh sessions send none.
    // Billing is OUTPUT-only (locked): history tokens never enter `cost` —
    // neither the user charge nor the miner earning below.
    let history = [];
    let historyTruncated = false;
    let historyTokens = 0;
    try {
      const built = await buildHistory(sessionId);
      history = built.history;
      historyTruncated = built.truncated;
      historyTokens = built.tokens;
    } catch (err) {
      logger.error({ err }, 'History window failed (proceeding without context)');
    }
    const needHistory = history.length > 0;
    // Sticky sessions: one session sticks to one miner (style + context
    // continuity). Guests have no session → pure weighted round-robin.
    const sessionKey = sessionId ? `s:${sessionId}` : null;

    const hasCandidates = wsServer
      && wsServer.findMinersForModel(requestedModel, needsMedia, needHistory).length > 0;

    // Create task (miner_id is claimed below once a candidate takes it).
    // The history snapshot is stored for audit/repro of what was dispatched.
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status, session_id, media, prepared_prompt, history)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
       RETURNING id`,
      [userId, null, message, requestedModel, sessionId, dbAttachment,
       effectiveMessage !== message ? effectiveMessage : null,
       JSON.stringify(history)]
    );

    const taskId = taskResult.rows[0].id;
    let response, tokensUsed, cost;
    let lastMinerError = null;
    let servedByMiner = false;
    let minerId = null;

    const failTask = async (note) => {
      await pool.query(
        "UPDATE tasks SET response = $1, status = 'failed', completed_at = CURRENT_TIMESTAMP WHERE id = $2",
        [note, taskId]
      );
    };

    if (!hasCandidates) {
      const usableCount = wsServer ? wsServer.countUsableMiners(needsMedia) : 0;
      if (usableCount === 0) {
        // No miners online at all — the client shows a waiting state and
        // auto-retries (retryable: true).
        await failTask('No miners online');
        return res.status(503).json({
          error: 'No GPU miners are online right now. Your message is kept — please wait for a miner to connect and retry.',
          code: 'MINER_OFFLINE',
          task_id: taskId,
          retryable: true,
        });
      }
      // Miners are online, but none holds the requested model — suggest a
      // switch instead of silently serving another model's output.
      const counts = wsServer.onlineModelCounts(needsMedia, needHistory);
      const alternatives = buildAlternatives(requestedModel, counts).slice(0, 6);
      await failTask('No miner holds the requested model');
      return res.status(409).json({
        error: `No online miner serves ${requestedModel} right now. Switch to one of these models or wait.`,
        code: 'MODEL_UNAVAILABLE',
        requested_model: requestedModel,
        alternatives,
        task_id: taskId,
        retryable: false,
      });
    }

    // Sticky + weighted-RR selection with failover: each pick honours the
    // session affinity (spilling past SPILL_CAP in-flight tasks), and every
    // outcome feeds the per-model health counters.
    const tried = new Set();
    for (;;) {
      const cand = wsServer.pickCandidate({
        model: requestedModel, needsMedia, needHistory, sessionKey, exclude: tried,
      });
      if (!cand) break;
      tried.add(cand.minerId);
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [cand.minerId, taskId]);

        logger.debug({
          taskId, minerId: cand.minerId, model: cand.model,
          media: needsMedia, historyTurns: history.length / 2, historyTokens, historyTruncated,
        }, 'Dispatching task to miner');
        const result = await wsServer.dispatchTask(cand.minerId, taskId, effectiveMessage, cand.model, media, history);

        if (result.error) {
          logger.warn({ taskId, minerId: cand.minerId, err: result.error }, 'Miner task failed, trying next miner');
          wsServer.recordModelResult(cand.minerId, requestedModel, false);
          lastMinerError = result.error;
          continue;
        }
        const reported = Number(result.tokens_used);
        if (!Number.isFinite(reported) || reported < 0 || reported > MAX_TASK_TOKENS) {
          // Out-of-bounds report: reject the miner result and try the next
          // candidate — never charge the user or pay the miner for it.
          logger.warn({ taskId, minerId: cand.minerId, tokens_used: result.tokens_used }, 'Rejecting miner result: tokens_used out of bounds');
          wsServer.recordModelResult(cand.minerId, requestedModel, false);
          lastMinerError = 'tokens_used out of bounds';
          continue;
        }
        response = result.response;
        tokensUsed = reported;
        servedByMiner = true;
        minerId = cand.minerId;
        wsServer.recordModelResult(cand.minerId, requestedModel, true);
        const pricing = getModelPricing(requestedModel);
        cost = (tokensUsed * pricing.outputPrice) / 1000000;
        break;

      } catch (wsError) {
        logger.warn({ taskId, err: wsError.message }, 'WebSocket dispatch failed, trying next miner');
        wsServer.recordModelResult(cand.minerId, requestedModel, false);
        lastMinerError = wsError.message;
      }
    }

    if (!response) {
      // Every exact-model candidate failed — retryable, like offline.
      await failTask('All miners failed for this task');
      const detail = lastMinerError
        ? ` (miner: ${sanitizeMinerDetail(lastMinerError)})`
        : '';
      return res.status(503).json({
        error: `Miners failed to answer right now. Your message is kept — please retry shortly.${detail}`,
        code: 'MINER_OFFLINE',
        task_id: taskId,
        retryable: true,
      });
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

    // Payment (v3.28.0). Inside ONE transaction with row locks, in order:
    //   1. the daily free allowance (2M/day Free, up to 80M/day on a plan;
    //      guests are tracked by IP) — platform-funded: no wallet debit, no
    //      miner revenue share;
    //   2. the free miner credit (v3.25, signed-in only) — platform-funded;
    //   3. the prepaid token pot (v3.28, $1 = 1M, never expires) — the miner
    //      earns a flat 90% of the message's catalog value, paid by the
    //      platform out of the bundle revenue;
    //   4. the signed-in user's USD wallet (miner gets a flat 90% of the
    //      debit regardless of the payer's plan; a balance below the cost is
    //      drained in full so the wallet can actually reach zero and the
    //      upgrade wall shows on the next message);
    //   5. if a race exhausts everything between pre-flight and settlement,
    //      the reply — which already exists — is still served as 'free'
    //      (never block after generation: the v3.26 spirit for races).
    // Every miner earning row records which source paid (wallet/tokens) and
    // which plan the payer was on — that is the 5-way breakdown shown on the
    // profile. Free legs earn the miner nothing (platform-funded).
    // A subject with no coverage never reaches here: the pre-flight wall
    // (402 upgrade_required) rejected it before dispatch.
    let paymentStatus = 'free';
    let minerCreditRemaining = null;
    let freeRemaining = preFlightFree ? preFlightFree.remaining : null;
    let tokenBalanceRemaining = null;
    let upgradeNotice = false;

    // Attribution for miner_coin_earnings on paid legs (lazy: only when a
    // miner actually earns). source = payment source, plan_type = the plan
    // the paying user was on at settlement time.
    const creditMinerEarning = async (client, earning, source) => {
      const payerPlan = await getActivePlan(userId, client);
      await client.query(
        'UPDATE miners SET earnings = earnings + $1 WHERE id = $2',
        [earning, minerId]
      );
      await client.query(
        `INSERT INTO miner_coin_earnings (miner_id, coin, amount, task_id, source, plan_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [minerId, paymentCoin, earning, taskId, source, payerPlan ? payerPlan.plan_type : 'free']
      );
    };

    if (cost > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const freeCharge = await chargeFreeTokens({
          userId, guestKey, tokens: tokensUsed, cap: freeCap, client,
        });
        freeRemaining = freeCharge.remaining;

        if (freeCharge.charged) {
          paymentStatus = 'free';
        } else if (userId) {
          const creditCharge = await chargeMinerCredit(userId, cost, client);
          minerCreditRemaining = creditCharge.remaining;

          if (creditCharge.charged) {
            paymentStatus = 'free_miner';
          } else {
            const potCharge = await chargeTokenPot({ userId, tokens: tokensUsed, client });

            if (potCharge.charged) {
              tokenBalanceRemaining = potCharge.remaining;
              paymentStatus = 'tokens';
              // Flat 90% of the message's catalog value — same rate as the
              // wallet leg, paid from the platform's bundle revenue.
              if (minerId && servedByMiner) {
                await creditMinerEarning(client, cost * MINER_REVENUE_SHARE, 'tokens');
              }
            } else {
              const balanceResult = await client.query(
                'SELECT available FROM user_coin_balances WHERE user_id = $1 AND coin = $2 FOR UPDATE',
                [userId, paymentCoin]
              );
              const userBalance = parseFloat(balanceResult.rows[0]?.available || 0);

              if (userBalance > 0) {
                // Drain dust: a sub-cost balance is taken in full, so the wallet
                // reaches exactly 0 instead of parking at $0.0000x forever.
                const debit = Math.min(cost, userBalance);
                await client.query(
                  `UPDATE user_coin_balances
                      SET available = available - $1, total_spent = total_spent + $1
                    WHERE user_id = $2 AND coin = $3`,
                  [debit, userId, paymentCoin]
                );

                // Only a miner that actually served the task earns.
                // Flat 90% for every payer (Free/Plus/Pro/Max alike).
                if (minerId && servedByMiner) {
                  await creditMinerEarning(client, debit * MINER_REVENUE_SHARE, 'wallet');
                }
                paymentStatus = 'paid';
                upgradeNotice = true;
              }
              // else: race after pre-flight — serve free (step 5).
            }
          }
        }
        // Guests out of allowance mid-race: step 5 (status stays 'free').

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }

      // The balance payload now carries free_tokens/pot too — any charge changes it.
      invalidateCache('/api/payments/balance');
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
      source: 'miner',
      miner_credit_remaining: minerCreditRemaining,
      free_tokens_remaining: freeRemaining,
      ...(tokenBalanceRemaining !== null ? { token_balance_remaining: tokenBalanceRemaining } : {}),
      ...(upgradeNotice ? {
        notice: 'upgrade_recommended',
        plans: listPlans(),
        token_bundle: {
          price_per_million: TOKEN_BUNDLE.price_per_million,
          tokens_per_usd: TOKEN_BUNDLE.tokens_per_usd,
          min_usd: TOKEN_BUNDLE.min_usd,
          max_usd: TOKEN_BUNDLE.max_usd,
        },
      } : {}),
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

// Test hook: the 503 detail sanitiser is module-private; expose it the same
// way stats.js exposes its aggregate reset.
router.__sanitizeMinerDetail = sanitizeMinerDetail;
router.__buildAlternatives = buildAlternatives;

module.exports = router;
