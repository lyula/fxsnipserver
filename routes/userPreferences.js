const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const userPreferencesController = require('../controllers/userPreferencesController');

// Get user preferences
router.get('/', authenticate, userPreferencesController.getPreferences);

// Update trading preferences
router.put('/trading', authenticate, userPreferencesController.updateTradingPreferences);

// Add confluence
router.post('/confluences', authenticate, userPreferencesController.addConfluence);

// Remove confluence
router.delete('/confluences/:confluenceId', authenticate, userPreferencesController.removeConfluence);

// Add preferred pair
router.post('/preferred-pairs', authenticate, userPreferencesController.addPreferredPair);

// Remove preferred pair
router.delete('/preferred-pairs/:pair', authenticate, userPreferencesController.removePreferredPair);

// Update dashboard settings
router.put('/dashboard', authenticate, userPreferencesController.updateDashboardSettings);

// Update notification preferences
router.put('/notifications', authenticate, userPreferencesController.updateNotificationPreferences);

module.exports = router;
