const express = require('express');
const router = express.Router();
const notificationPreferencesController = require('../controllers/notificationPreferencesController');
const { requireAuth } = require('../middleware/auth');

// Get current user's notification preferences
router.get('/', requireAuth, notificationPreferencesController.getPreferences);

// Update current user's notification preferences
router.put('/', requireAuth, notificationPreferencesController.updatePreferences);

module.exports = router;
