const express = require('express');
const router = express.Router();
const { requireAuth } = require("../middleware/auth"); // Add auth middleware
const badgePaymentController = require('../controllers/badgePaymentController');
const { createBadgePayment, initiateSTKPush, payheroCallback, getLatestBadgePayment, getAllBadgePayments, getAllBadgePaymentsAdmin } = badgePaymentController;

// Create a badge payment
router.post('/', requireAuth, createBadgePayment);

// Initiate PayHero STK Push
router.post('/initiate-stk', requireAuth, initiateSTKPush);

// PayHero callback endpoint
router.post('/payhero-callback', payheroCallback);

// Get latest badge payment for current user
router.get('/latest', requireAuth, getLatestBadgePayment);

// Get all badge payments for current user (history)
router.get('/my', requireAuth, getAllBadgePayments);

// Get all badge payments (admin)
router.get('/all', getAllBadgePaymentsAdmin); // Add admin auth in production

// Get a badge payment by ID (for notifications and details)
router.get('/:id', requireAuth, badgePaymentController.getBadgePaymentById);

module.exports = router;
