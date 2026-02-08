const EAApiKeyModel = require('../models/EAApiKey');
const { hashKey } = EAApiKeyModel;

/**
 * Resolve EA API key from Authorization: Bearer <key> or X-API-Key: <key>.
 * Sets req.eaKeyDoc with { _id, userId, accountId } and req.user = { _id: userId } for downstream.
 * Use only on POST /api/ea/push-trades (no JWT).
 */
async function requireEAApiKey(req, res, next) {
  const rawKey =
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null) ||
    (req.headers['x-api-key'] && req.headers['x-api-key'].trim()) ||
    null;

  if (!rawKey) {
    return res.status(401).json({ success: false, message: 'API key required. Use Authorization: Bearer <key> or X-API-Key: <key>.' });
  }

  const keyHash = hashKey(rawKey);
  const keyDoc = await EAApiKeyModel.findOne({ keyHash }).lean();
  if (!keyDoc) {
    return res.status(401).json({ success: false, message: 'Invalid or revoked API key.' });
  }

  req.eaKeyDoc = keyDoc;
  req.user = { _id: keyDoc.userId, id: keyDoc.userId };
  next();
}

module.exports = { requireEAApiKey };
