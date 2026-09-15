const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');
const { invalidateCache } = require('../cache');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, model } = req.body;
    const userId = req.user?.id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get WebSocket server instance
    const wsServer = req.app.get('wsServer');

    // Try to find an online miner for this model
    const minerId = wsServer ? wsServer.findMinerForModel(model) : null;

    // Create task
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id`,
      [userId, minerId, message, model || 'llama3:8b']
    );

    const taskId = taskResult.rows[0].id;

    // Try WebSocket dispatch first
    if (wsServer && minerId) {
      try {
        await pool.query("UPDATE tasks SET status = 'processing', miner_id = $1 WHERE id = $2", [minerId, taskId]);

        const result = await wsServer.dispatchTask(minerId, taskId, message, model);

        if (result.error) {
          await pool.query("UPDATE tasks SET response = $1, status = 'failed' WHERE id = $2", [result.error, taskId]);
          return res.status(500).json({ error: result.error, task_id: taskId });
        }

        const tokensUsed = result.tokens_used || 0;
        const cost = tokensUsed * 0.001;

        res.json({
          success: true,
          response: result.response,
          task_id: taskId,
          tokens_used: tokensUsed,
          cost,
          miner_id: minerId,
          source: 'miner'
        });
        invalidateCache('/api/stats');
        return;

      } catch (wsError) {
        console.log(`WebSocket dispatch failed: ${wsError.message}, falling back to local Ollama`);
      }
    }

    // Fallback: local Ollama on VPS
    try {
      const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: model || 'llama3:8b',
        prompt: message,
        stream: false
      });

      const response = ollamaResponse.data.response;
      const tokensUsed = ollamaResponse.data.eval_count || 0;
      const cost = tokensUsed * 0.001;

      await pool.query(
        `UPDATE tasks
         SET response = $1, tokens_used = $2, cost = $3, status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [response, tokensUsed, cost, taskId]
      );

      res.json({
        success: true,
        response,
        task_id: taskId,
        tokens_used: tokensUsed,
        cost,
        miner_id: null,
        source: 'local'
      });
      invalidateCache('/api/stats');

    } catch (ollamaError) {
      await pool.query(
        "UPDATE tasks SET response = 'No miners or Ollama available', status = 'failed' WHERE id = $1",
        [taskId]
      );

      res.status(503).json({
        error: 'No miners available for this model. Please try again later.',
        task_id: taskId
      });
    }

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
