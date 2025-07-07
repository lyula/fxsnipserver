const express = require('express');
const router = express.Router();
const { getBadgePricing, updateBadgePricing } = require('../controllers/badgePricingController');
const requireAuth = require('../middleware/auth');

// Public: get badge pricing
router.get('/', getBadgePricing);
// Admin: update badge pricing (add admin check in production)
router.put('/', requireAuth, updateBadgePricing);

module.exports = router;
