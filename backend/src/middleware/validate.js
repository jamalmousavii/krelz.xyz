const { body, param, query, validationResult } = require('express-validator');

// Handle validation errors
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// Auth validators
const registerRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['user', 'miner', 'admin']).withMessage('Invalid role'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
];

const googleAuthRules = [
  body('credential').notEmpty().withMessage('Google credential required'),
];

// Chat validators
const chatRules = [
  body('message').trim().isLength({ min: 1, max: 10000 }).withMessage('Message required (max 10000 chars)'),
  body('model').optional().isLength({ max: 100 }).withMessage('Model name too long'),
];

// Miner validators
const minerRegisterRules = [
  body('wallet_address').isLength({ min: 42, max: 42 }).withMessage('Valid wallet address required'),
  body('gpu_model').optional().isLength({ max: 100 }),
  body('ram').optional().isLength({ max: 50 }),
  body('cpu').optional().isLength({ max: 100 }),
];

const heartbeatRules = [
  body('status').isIn(['online', 'offline', 'busy']).withMessage('Invalid status'),
  body('gpu_usage').optional().isFloat({ min: 0, max: 100 }),
  body('ram_usage').optional().isFloat({ min: 0, max: 100 }),
];

// Payment validators
const depositRules = [
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be positive'),
  body('tx_hash').optional().isLength({ max: 66 }),
];

const deductRules = [
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be positive'),
  body('reason').optional().isLength({ max: 200 }),
];

const transferRules = [
  body('to_user_id').isInt({ min: 1 }).withMessage('Valid recipient required'),
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be positive'),
];

const stakeRules = [
  body('amount').isFloat({ min: 0.00000001 }).withMessage('Amount must be positive'),
];

module.exports = {
  validate,
  registerRules,
  loginRules,
  googleAuthRules,
  chatRules,
  minerRegisterRules,
  heartbeatRules,
  depositRules,
  deductRules,
  transferRules,
  stakeRules,
};
