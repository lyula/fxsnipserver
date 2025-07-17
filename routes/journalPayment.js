const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const journalPaymentController = require('../controllers/journalPaymentController');

// Create payment and initiate STK push
router.post('/', auth, journalPaymentController.createJournalPayment);

// Payhero callback
router.post('/payhero-callback', journalPaymentController.payheroCallback);

// Get latest payment for user
router.get('/latest', auth, journalPaymentController.getLatestJournalPayment);

// Get all payments for user
router.get('/', auth, journalPaymentController.getAllJournalPayments);

// Poll payment status by paymentId (must come after router is defined)
router.get('/status', auth, journalPaymentController.getJournalPaymentStatus);

module.exports = router;
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const journalPaymentController = require('../controllers/journalPaymentController');

// Create payment and initiate STK push
router.post('/', auth, journalPaymentController.createJournalPayment);

// Payhero callback
router.post('/payhero-callback', journalPaymentController.payheroCallback);

// Get latest payment for user
router.get('/latest', auth, journalPaymentController.getLatestJournalPayment);

// Get all payments for user
router.get('/', auth, journalPaymentController.getAllJournalPayments);

module.exports = router;
