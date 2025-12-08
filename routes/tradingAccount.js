const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const tradingAccountController = require('../controllers/tradingAccountController');

// Connect a new trading account
router.post('/connect', requireAuth, tradingAccountController.connectAccount);

// Get all user's trading accounts
router.get('/', requireAuth, tradingAccountController.getAccounts);

// Get dashboard summary (aggregated stats)
router.get('/dashboard-summary', requireAuth, tradingAccountController.getDashboardSummary);

// Get specific account details
router.get('/:accountId', requireAuth, tradingAccountController.getAccount);

// Sync account data from MetaAPI
router.post('/:accountId/sync', requireAuth, tradingAccountController.syncAccount);

// Get account statistics
router.get('/:accountId/stats', requireAuth, tradingAccountController.getAccountStats);

// Set primary account
router.put('/:accountId/set-primary', requireAuth, tradingAccountController.setPrimaryAccount);

// Disconnect account
router.post('/:accountId/disconnect', requireAuth, tradingAccountController.disconnectAccount);

// Delete account
router.delete('/:accountId', requireAuth, tradingAccountController.deleteAccount);

module.exports = router;
