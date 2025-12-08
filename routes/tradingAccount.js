const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const tradingAccountController = require('../controllers/tradingAccountController');

// Connect a new trading account
router.post('/connect', authenticate, tradingAccountController.connectAccount);

// Get all user's trading accounts
router.get('/', authenticate, tradingAccountController.getAccounts);

// Get dashboard summary (aggregated stats)
router.get('/dashboard-summary', authenticate, tradingAccountController.getDashboardSummary);

// Get specific account details
router.get('/:accountId', authenticate, tradingAccountController.getAccount);

// Sync account data from MetaAPI
router.post('/:accountId/sync', authenticate, tradingAccountController.syncAccount);

// Get account statistics
router.get('/:accountId/stats', authenticate, tradingAccountController.getAccountStats);

// Set primary account
router.put('/:accountId/set-primary', authenticate, tradingAccountController.setPrimaryAccount);

// Disconnect account
router.post('/:accountId/disconnect', authenticate, tradingAccountController.disconnectAccount);

// Delete account
router.delete('/:accountId', authenticate, tradingAccountController.deleteAccount);

module.exports = router;
