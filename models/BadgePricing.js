const mongoose = require('mongoose');

const badgePricingSchema = new mongoose.Schema({
  badgeMonthlyUSD: { type: Number, required: true, default: 0 },
  badgeAnnualUSD: { type: Number, required: true, default: 0 },
  usdToKes: { type: Number, required: true, default: 0 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BadgePricing', badgePricingSchema);
