const express = require('express');
const router = express.Router();
const { createBadgePayment, initiateSTKPush, payheroCallback, getLatestBadgePayment } = require('../controllers/badgePaymentController');
const requireAuth = require("../middleware/auth"); // Add auth middleware

// Create a badge payment
router.post('/', requireAuth, createBadgePayment);

// Initiate PayHero STK Push
router.post('/initiate-stk', requireAuth, initiateSTKPush);

// PayHero callback endpoint
router.post('/payhero-callback', payheroCallback);

// Get latest badge payment for current user
router.get('/latest', requireAuth, getLatestBadgePayment);

module.exports = router;
