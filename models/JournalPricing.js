const mongoose = require('mongoose');

const journalPricingSchema = new mongoose.Schema({
  unlimitedUSD: { type: Number, required: true, default: 2.0 },
  screenrecordingUSD: { type: Number, required: true, default: 9.99 },
  usdToKes: { type: Number, required: true, default: 130 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JournalPricing', journalPricingSchema);
