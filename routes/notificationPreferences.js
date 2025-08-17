const express = require('express');
const router = express.Router();
const notificationPreferencesController = require('../controllers/notificationPreferencesController');
const { authenticate } = require('../middleware/auth');

// Get current user's notification preferences
router.get('/', authenticate, notificationPreferencesController.getPreferences);

// Update current user's notification preferences
router.put('/', authenticate, notificationPreferencesController.updatePreferences);

module.exports = router;
