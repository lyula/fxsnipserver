const express = require('express');
const router = express.Router();
const adInteractionController = require('../controllers/adInteractionController');
const auth = require('../middleware/auth');

// Like/unlike an ad
router.post('/:adId/like', auth, adInteractionController.likeAd);

// Comment on an ad
router.post('/:adId/comment', auth, adInteractionController.commentAd);

// Reply to a comment
router.post('/:adId/comment/:commentId/reply', auth, adInteractionController.replyComment);

// Share an ad
router.post('/:adId/share', auth, adInteractionController.shareAd);

// Track a view
router.post('/:adId/view', auth, adInteractionController.viewAd);

// Get all interactions for an ad
router.get('/:adId', adInteractionController.getAdInteractions);

module.exports = router;
