const BadgePricing = require('../models/BadgePricing');
const axios = require('axios');

// Get current badge pricing
exports.getBadgePricing = async (req, res) => {
  try {
    let pricing = await BadgePricing.findOne();
    if (!pricing) {
      pricing = await BadgePricing.create({});
    }
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update badge pricing (admin only)
exports.updateBadgePricing = async (req, res) => {
  try {
    const { badgeMonthlyUSD, badgeAnnualUSD } = req.body;
    let pricing = await BadgePricing.findOne();
    if (!pricing) pricing = await BadgePricing.create({});
    if (badgeMonthlyUSD !== undefined) pricing.badgeMonthlyUSD = badgeMonthlyUSD;
    if (badgeAnnualUSD !== undefined) pricing.badgeAnnualUSD = badgeAnnualUSD;
    pricing.lastUpdated = new Date();
    await pricing.save();
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update USD/KES rate (cron job)
const JournalPricing = require('../models/JournalPricing');
exports.updateUsdToKes = async () => {
  try {
    // Use a free forex API 
    const resp = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = resp.data.rates.KES;
    if (rate) {
      // Update BadgePricing
      let pricing = await BadgePricing.findOne();
      if (!pricing) pricing = await BadgePricing.create({});
      pricing.usdToKes = rate;
      pricing.lastUpdated = new Date();
      await pricing.save();

      // Update JournalPricing
      let journalPricing = await JournalPricing.findOne();
      if (!journalPricing) journalPricing = await JournalPricing.create({});
      journalPricing.usdToKes = rate;
      journalPricing.lastUpdated = new Date();
      await journalPricing.save();
    }
  } catch (err) {
    console.error('Failed to update USD/KES rate:', err.message);
  }
};
