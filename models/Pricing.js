const mongoose = require('mongoose');

const pricingSchema = new mongoose.Schema({
  badgeMonthlyUSD: { type: Number, required: true, default: 1 },
  badgeAnnualUSD: { type: Number, required: true, default: 10 },
  usdToKes: { type: Number, required: true, default: 130 },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Pricing', pricingSchema);
