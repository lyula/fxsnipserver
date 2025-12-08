const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const userPreferencesController = require('../controllers/userPreferencesController');

// Get user preferences
router.get('/', requireAuth, userPreferencesController.getPreferences);

// Update trading preferences
router.put('/trading', requireAuth, userPreferencesController.updateTradingPreferences);

// Add confluence
router.post('/confluences', requireAuth, userPreferencesController.addConfluence);

// Remove confluence
router.delete('/confluences/:confluenceId', requireAuth, userPreferencesController.removeConfluence);

// Add preferred pair
router.post('/preferred-pairs', requireAuth, userPreferencesController.addPreferredPair);

// Remove preferred pair
router.delete('/preferred-pairs/:pair', requireAuth, userPreferencesController.removePreferredPair);

// Update dashboard settings
router.put('/dashboard', requireAuth, userPreferencesController.updateDashboardSettings);

// Update notification preferences
router.put('/notifications', requireAuth, userPreferencesController.updateNotificationPreferences);

module.exports = router;
