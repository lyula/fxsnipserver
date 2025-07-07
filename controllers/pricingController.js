const Pricing = require('../models/Pricing');
const axios = require('axios');

// Get current pricing
exports.getPricing = async (req, res) => {
  try {
    let pricing = await Pricing.findOne();
    if (!pricing) {
      pricing = await Pricing.create({});
    }
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update pricing (admin only)
exports.updatePricing = async (req, res) => {
  try {
    const { badgeMonthlyUSD, badgeAnnualUSD } = req.body;
    let pricing = await Pricing.findOne();
    if (!pricing) pricing = await Pricing.create({});
    if (badgeMonthlyUSD) pricing.badgeMonthlyUSD = badgeMonthlyUSD;
    if (badgeAnnualUSD) pricing.badgeAnnualUSD = badgeAnnualUSD;
    pricing.lastUpdated = new Date();
    await pricing.save();
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update USD/KES rate (cron job)
exports.updateUsdToKes = async () => {
  try {
    // Use a free forex API (e.g., exchangerate-api.com)
    const resp = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = resp.data.rates.KES;
    if (rate) {
      let pricing = await Pricing.findOne();
      if (!pricing) pricing = await Pricing.create({});
      pricing.usdToKes = rate;
      pricing.lastUpdated = new Date();
      await pricing.save();
    }
  } catch (err) {
    console.error('Failed to update USD/KES rate:', err.message);
  }
};
