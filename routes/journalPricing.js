const express = require('express');
const router = express.Router();
const journalPricingController = require('../controllers/journalPricingController');

// Get current journal pricing
router.get('/', journalPricingController.getJournalPricing);

module.exports = router;
