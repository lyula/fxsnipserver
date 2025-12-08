const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const tradeJournalController = require('../controllers/tradeJournalController');

// Get all trades with filters (timeframe, pair, session, status)
router.get('/', authenticate, tradeJournalController.getTrades);

// Get trade statistics
router.get('/stats', authenticate, tradeJournalController.getTradeStats);

// Create manual trade entry
router.post('/manual', authenticate, tradeJournalController.createManualTrade);

// Get specific trade details
router.get('/:tradeId', authenticate, tradeJournalController.getTrade);

// Update trade notes (confluences, emotions, strategy, etc.)
router.put('/:tradeId/notes', authenticate, tradeJournalController.updateTradeNotes);

// Add screenshots to trade
router.post('/:tradeId/screenshots', authenticate, tradeJournalController.addScreenshots);

// Delete trade (manual trades only)
router.delete('/:tradeId', authenticate, tradeJournalController.deleteTrade);

module.exports = router;
