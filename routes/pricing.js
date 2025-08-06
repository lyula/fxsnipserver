const express = require('express');
const router = express.Router();
const { getPricing, updatePricing } = require('../controllers/pricingController');
const { requireAuth } = require('../middleware/auth');

// Public: get pricing
router.get('/', getPricing);
// Admin: update pricing (add admin check in production)
router.put('/', requireAuth, updatePricing);

module.exports = router;
