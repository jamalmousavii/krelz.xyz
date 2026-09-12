const express = require('express');
const router = express.Router();
const MODELS = require('../models');

// GET /api/models
router.get('/', (req, res) => {
  const { category } = req.query;
  let models = MODELS;
  if (category) {
    models = MODELS.filter(m => m.category === category);
  }
  res.json({ success: true, models });
});

// GET /api/models/categories
router.get('/categories', (req, res) => {
  const categories = [...new Set(MODELS.map(m => m.category))];
  res.json({ success: true, categories });
});

module.exports = router;
