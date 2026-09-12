const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3:8b';

// POST /api/chat
router.post('/', async (req, res) => {
  try {
    const { message, model } = req.body;
    const userId = req.user?.id;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // پیدا کردن ماینر آنلاین
    const minerResult = await pool.query(
      'SELECT id FROM miners WHERE status = $1 ORDER BY RANDOM() LIMIT 1',
      ['online']
    );
    
    const minerId = minerResult.rows[0]?.id;
    
    // ایجاد تسک
    const taskResult = await pool.query(
      `INSERT INTO tasks (user_id, miner_id, prompt, model, status) 
       VALUES ($1, $2, $3, $4, 'processing') 
       RETURNING id`,
      [userId, minerId, message, model || OLLAMA_MODEL]
    );
    
    const taskId = taskResult.rows[0].id;
    
    // ارسال درخواست به Ollama
    try {
      const ollamaResponse = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model: model || OLLAMA_MODEL,
        prompt: message,
        stream: false
      });
      
      const response = ollamaResponse.data.response;
      const tokensUsed = ollamaResponse.data.eval_count || 0;
      const cost = tokensUsed * 0.001; // 0.001 KRELZ per token
      
      // به‌روزرسانی تسک
      await pool.query(
        `UPDATE tasks 
         SET response = $1, tokens_used = $2, cost = $3, status = 'completed', completed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [response, tokensUsed, cost, taskId]
      );
      
      // به‌روزرسانی آمار ماینر
      if (minerId) {
        await pool.query(
          'UPDATE miners SET total_tasks = total_tasks + 1, earnings = earnings + $1 WHERE id = $2',
          [cost * 0.9, minerId] // 90% برای ماینر
        );
      }
      
      res.json({
        success: true,
        response,
        task_id: taskId,
        tokens_used: tokensUsed,
        cost,
        miner_id: minerId
      });
      
    } catch (ollamaError) {
      // اگر Ollama متصل نبود، پاسخ پیش‌فرض
      await pool.query(
        "UPDATE tasks SET response = 'Ollama not available', status = 'failed' WHERE id = $1",
        [taskId]
      );
      
      res.status(503).json({
        error: 'LLM service unavailable',
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
