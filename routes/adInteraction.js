const express = require('express');
const router = express.Router();
const adInteractionController = require('../controllers/adInteractionController');
const { requireAuth } = require('../middleware/auth');

// Like/unlike an ad
router.post('/:adId/like', requireAuth, adInteractionController.likeAd);

// Comment on an ad
router.post('/:adId/comment', requireAuth, adInteractionController.commentAd);

// Reply to a comment
router.post('/:adId/comment/:commentId/reply', requireAuth, adInteractionController.replyComment);

// Share an ad
router.post('/:adId/share', requireAuth, adInteractionController.shareAd);

// Track a view
router.post('/:adId/view', requireAuth, adInteractionController.viewAd);

// Get all interactions for an ad
router.get('/:adId', adInteractionController.getAdInteractions);

module.exports = router;
