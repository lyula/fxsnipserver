const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  processAdPayment,
  getPaymentHistory,
  refundAdPayment,
  getPaymentStats
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User payment routes
router.post('/ads/:id/pay', [
  body('paymentMethod')
    .notEmpty()
    .withMessage('Payment method is required'),
  body('cardDetails')
    .optional()
    .isObject()
    .withMessage('Card details must be an object')
], processAdPayment);

router.get('/history', getPaymentHistory);

// Admin payment routes
router.use('/admin', authorize('admin'));
router.get('/admin/stats', getPaymentStats);
router.post('/ads/:id/refund', [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Refund reason must be between 10 and 500 characters')
], refundAdPayment);

module.exports = router;
