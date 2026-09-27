const express = require('express');
const router = express.Router();
const pool = require('../database/pool');
const MODELS = require('../models');
const { logger } = require('../logger');

// GET /api/models
router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    let models = MODELS;
    if (category) {
      models = MODELS.filter(m => m.category === category);
    }

    // Get miner counts per model. Models no longer in the catalog (e.g. a
    // removed qwen3.6:27b) are reported separately instead of being silently
    // credited to another model's badge.
    const minerCounts = {};
    let totalOnline = 0;
    const unknownModels = {};
    try {
      const onlineResult = await pool.query(
        `SELECT current_model, COUNT(*) as cnt
         FROM miners WHERE status = 'online'
         GROUP BY current_model`
      );
      const knownIds = new Set(MODELS.map(m => m.id));
      for (const row of onlineResult.rows) {
        const cnt = parseInt(row.cnt, 10);
        const modelId = row.current_model || 'llama3.1:8b';
        totalOnline += cnt;
        if (knownIds.has(modelId)) {
          minerCounts[modelId] = (minerCounts[modelId] || 0) + cnt;
        } else {
          unknownModels[modelId] = (unknownModels[modelId] || 0) + cnt;
        }
      }
    } catch (e) {
      logger.error({ err: e }, 'models.js: miners online query failed');
    }

    // Merge model data with miner counts
    const modelsWithMiners = models.map(m => ({
      ...m,
      miners_online: minerCounts[m.id] || 0,
    }));

    res.json({
      success: true,
      models: modelsWithMiners,
      miners_online_total: totalOnline,
      unknown_models: unknownModels,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/models failed');
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/models/categories
router.get('/categories', (req, res) => {
  const categories = [...new Set(MODELS.map(m => m.category))];
  res.json({ success: true, categories });
});

module.exports = router;
