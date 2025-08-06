const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllAds,
  approveAd,
  rejectAd,
  pauseAd,
  resumeAd,
  updateAdPerformance,
  getAdAnalytics
} = require('../controllers/adminAdController');
const { protect, authorize } = require('../middleware/auth');

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

// Analytics and overview
router.get('/analytics', getAdAnalytics);

// Ad management
router.get('/', getAllAds);

// Ad approval/rejection
router.post('/:id/approve', approveAd);
router.post('/:id/reject', [
  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters')
], rejectAd);

// Ad control
router.post('/:id/pause', pauseAd);
router.post('/:id/resume', resumeAd);

// Performance tracking
router.put('/:id/performance', [
  body('impressions').optional().isInt({ min: 0 }).withMessage('Impressions must be a non-negative integer'),
  body('clicks').optional().isInt({ min: 0 }).withMessage('Clicks must be a non-negative integer'),
  body('reach').optional().isInt({ min: 0 }).withMessage('Reach must be a non-negative integer'),
  body('engagement').optional().isInt({ min: 0 }).withMessage('Engagement must be a non-negative integer')
], updateAdPerformance);

module.exports = router;
