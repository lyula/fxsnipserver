const express = require('express');
const router = express.Router();
const { requireEAApiKey } = require('../middleware/eaAuth');
const eaController = require('../controllers/eaController');

// In-memory rate limit: 60 requests per minute per API key (by key id)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function rateLimitPush(req, res, next) {
  const keyId = req.eaKeyDoc && req.eaKeyDoc._id && req.eaKeyDoc._id.toString();
  if (!keyId) return next();

  const now = Date.now();
  let entry = rateLimitMap.get(keyId);
  if (!entry) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(keyId, entry);
  }
  if (now >= entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Try again after a minute.',
    });
  }
  next();
}

router.post('/push-trades', requireEAApiKey, rateLimitPush, eaController.pushTrades);

module.exports = router;
