const express = require('express');
const router = express.Router();
const { createBadgePayment, initiateSTKPush, payheroCallback } = require('../controllers/badgePaymentController');

// Create a badge payment
router.post('/', createBadgePayment);

// Initiate PayHero STK Push
router.post('/initiate-stk', initiateSTKPush);

// PayHero callback endpoint
router.post('/payhero-callback', payheroCallback);

module.exports = router;
