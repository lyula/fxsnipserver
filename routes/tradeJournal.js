const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const tradeJournalController = require('../controllers/tradeJournalController');

// Get all trades with filters (timeframe, pair, session, status)
router.get('/', requireAuth, tradeJournalController.getTrades);

// Get trade statistics
router.get('/stats', requireAuth, tradeJournalController.getTradeStats);

// Create manual trade entry
router.post('/manual', requireAuth, tradeJournalController.createManualTrade);

// Get specific trade details
router.get('/:tradeId', requireAuth, tradeJournalController.getTrade);

// Update trade notes (confluences, emotions, strategy, etc.)
router.put('/:tradeId/notes', requireAuth, tradeJournalController.updateTradeNotes);

// Add screenshots to trade
router.post('/:tradeId/screenshots', requireAuth, tradeJournalController.addScreenshots);

// Delete trade (manual trades only)
router.delete('/:tradeId', requireAuth, tradeJournalController.deleteTrade);

module.exports = router;
