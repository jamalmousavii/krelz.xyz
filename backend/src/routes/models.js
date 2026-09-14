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
    try {
      const onlineResult = await pool.query(
        `SELECT current_model, COUNT(*) as cnt
         FROM miners WHERE status = 'online'
         GROUP BY current_model`
      );
      for (const row of onlineResult.rows) {
        minerCounts[row.current_model] = parseInt(row.cnt);
      }
    } catch (e) {
      // miners table may not exist yet
    }

    // Merge model data with miner counts
    const modelsWithMiners = models.map(m => ({
      ...m,
      miners_online: minerCounts[m.id] || 0,
    }));

    res.json({ success: true, models: modelsWithMiners });
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
