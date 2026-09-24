const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const MODELS = require('../models');

// GET /api/models
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let models = MODELS;
    if (category) {
      models = MODELS.filter(m => m.category === category);
    }

    // Get miner counts per model
    const minerCounts = {};
    let totalOnline = 0;
    try {
      const onlineResult = await pool.query(
        `SELECT current_model, COUNT(*) as cnt
         FROM miners WHERE status = 'online'
         GROUP BY current_model`
      );
      const knownIds = new Set(models.map(m => m.id));
      const orphanCounts = {};
      for (const row of onlineResult.rows) {
        const cnt = parseInt(row.cnt);
        totalOnline += cnt;
        if (knownIds.has(row.current_model)) {
          minerCounts[row.current_model] = (minerCounts[row.current_model] || 0) + cnt;
        } else {
          // Unknown/removed model (e.g. qwen3.6:27b) — credit to llama3.1:8b badge
          orphanCounts['llama3.1:8b'] = (orphanCounts['llama3.1:8b'] || 0) + cnt;
        }
      }
      for (const [id, cnt] of Object.entries(orphanCounts)) {
        minerCounts[id] = (minerCounts[id] || 0) + cnt;
      }
    } catch (e) {
      console.error('models.js: miners online query failed:', e.message);
    }

    // Merge model data with miner counts
    const modelsWithMiners = models.map(m => ({
      ...m,
      miners_online: minerCounts[m.id] || 0,
    }));

    res.json({ success: true, models: modelsWithMiners, miners_online_total: totalOnline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/models/categories
router.get('/categories', (req, res) => {
  const categories = [...new Set(MODELS.map(m => m.category))];
  res.json({ success: true, categories });
});

module.exports = router;
