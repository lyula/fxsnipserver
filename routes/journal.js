const express = require('express');
const router = express.Router();
const journalController = require('../controllers/journalController');
const auth = require('../middleware/auth');

// For file uploads, use multer
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post('/', auth, journalController.createEntry);

router.get('/', auth, journalController.getEntries);

router.put('/:id', auth, journalController.updateEntry);
router.delete('/:id', auth, journalController.deleteEntry);

module.exports = router;
