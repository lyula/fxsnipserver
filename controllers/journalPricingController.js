const JournalPricing = require('../models/JournalPricing');
const axios = require('axios');

// Get current journal pricing
exports.getJournalPricing = async (req, res) => {
  try {
    let pricing = await JournalPricing.findOne();
    if (!pricing) {
      pricing = await JournalPricing.create({});
    }
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update USD/KES rate (cron job)
exports.updateUsdToKes = async () => {
  try {
    // Use a free forex API 
    const resp = await axios.get('https://open.er-api.com/v6/latest/USD');
    const rate = resp.data.rates.KES;
    if (rate) {
      let pricing = await JournalPricing.findOne();
      if (!pricing) pricing = await JournalPricing.create({});
      pricing.usdToKes = rate;
      pricing.lastUpdated = new Date();
      await pricing.save();
    }
  } catch (err) {
    console.error('Failed to update USD/KES rate for JournalPricing:', err.message);
  }
};
