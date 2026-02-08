const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const tradingAccountController = require('../controllers/tradingAccountController');

// Connect a new trading account (MetaAPI)
router.post('/connect', requireAuth, tradingAccountController.connectAccount);

// Connect a new EA-linked account (no MetaAPI; then get API key for this account)
router.post('/connect-ea', requireAuth, tradingAccountController.connectEAAccount);

// Get all user's trading accounts
router.get('/', requireAuth, tradingAccountController.getAccounts);

// Get dashboard summary (aggregated stats)
router.get('/dashboard-summary', requireAuth, tradingAccountController.getDashboardSummary);

// Get specific account details
router.get('/:accountId', requireAuth, tradingAccountController.getAccount);

// EA API key (per account, only for EA-linked accounts)
router.get('/:accountId/ea-api-key', requireAuth, tradingAccountController.getEAApiKey);
router.post('/:accountId/ea-api-key/regenerate', requireAuth, tradingAccountController.regenerateEAApiKey);

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
