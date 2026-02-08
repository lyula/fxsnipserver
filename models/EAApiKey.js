const mongoose = require('mongoose');
const crypto = require('crypto');

// One API key per trading account (accountId is required and unique).
const EAApiKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAccount', required: true, unique: true },
  keyHash: { type: String, required: true },
  keyPrefix: { type: String, required: true },
  lastUsedAt: { type: Date },
}, { timestamps: true });

EAApiKeySchema.index({ keyHash: 1 });
EAApiKeySchema.index({ accountId: 1 });

function hashKey(plainKey) {
  return crypto.createHash('sha256').update(plainKey, 'utf8').digest('hex');
}

function generateKey() {
  const prefix = 'fxj_';
  const randomPart = crypto.randomBytes(18).toString('base64url');
  return prefix + randomPart;
}

function getKeyPrefix(plainKey) {
  return plainKey.substring(0, 8);
}

module.exports = mongoose.model('EAApiKey', EAApiKeySchema);
module.exports.hashKey = hashKey;
module.exports.generateKey = generateKey;
module.exports.getKeyPrefix = getKeyPrefix;
