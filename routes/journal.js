const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const { requireAuth: auth } = require('../middleware/auth');


router.post('/', auth, journalController.createEntry);

router.get('/', auth, journalController.getEntries);

router.put('/:id', auth, journalController.updateEntry);
router.delete('/:id', auth, journalController.deleteEntry);

module.exports = router;
