const JournalEntry = require('../models/JournalEntry');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Update a journal entry
exports.updateEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user.id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Helper to check if two dates are the same calendar day
    function isSameDay(d1, d2) {
      return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
    }

    // Determine last edit date for after-trade fields
    // Use entry.date for first edit, or entry.afterTradeLastEdit if present
    const now = new Date();
    const lastEdit = entry.afterTradeLastEdit ? new Date(entry.afterTradeLastEdit) : new Date(entry.date);

    // If any after-trade fields are being updated, enforce same-day rule
    const updatingAfterFields = req.body.outcome || req.body.timeAfterPlayout || (req.files && (req.files.afterScreenshot || req.files.afterScreenRecording));
    if (updatingAfterFields && !isSameDay(now, lastEdit)) {
      return res.status(403).json({ error: 'After-trade fields can only be updated on the same day as the last edit.' });
    }

    // Update outcome and after-trade files/fields
    let afterTradeEdited = false;
    if (req.body.outcome) { entry.outcome = req.body.outcome; afterTradeEdited = true; }
    if (req.body.timeAfterPlayout) { entry.timeAfterPlayout = req.body.timeAfterPlayout; afterTradeEdited = true; }

    // Accept afterScreenshot and afterScreenRecording from JSON (frontend)
    if (req.body.afterScreenshot && typeof req.body.afterScreenshot === 'object') {
      entry.afterScreenshot = req.body.afterScreenshot;
      afterTradeEdited = true;
    }
    if (req.body.afterScreenRecording && typeof req.body.afterScreenRecording === 'object') {
      entry.afterScreenRecording = req.body.afterScreenRecording;
      afterTradeEdited = true;
    }

    // Accept file uploads (if present)
    if (req.files) {
      if (req.files.afterScreenshot) {
        const result = await cloudinary.uploader.upload(
          req.files.afterScreenshot[0].path,
          { folder: 'journals', resource_type: 'image' }
        );
        entry.afterScreenshot = { url: result.secure_url, publicId: result.public_id };
        afterTradeEdited = true;
      }
      if (req.files.afterScreenRecording) {
        const result = await cloudinary.uploader.upload(
          req.files.afterScreenRecording[0].path,
          { folder: 'journals', resource_type: 'video' }
        );
        entry.afterScreenRecording = { url: result.secure_url, publicId: result.public_id };
        afterTradeEdited = true;
      }
    }
    // If any after-trade fields were edited, update last edit timestamp
    if (afterTradeEdited) {
      entry.afterTradeLastEdit = now;
    }
    await entry.save();
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a journal entry and its files from Cloudinary
exports.deleteEntry = async (req, res) => {
  try {
    console.log('DeleteEntry called for id:', req.params.id, 'user:', req.user.id);
    const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user.id });
    if (!entry) {
      console.log('DeleteEntry: Entry not found for id:', req.params.id, 'user:', req.user.id);
      return res.status(404).json({ error: 'Entry not found' });
    }
    const cloudinary = require('cloudinary').v2;
    // Remove files from Cloudinary if publicId exists
    const fileFields = ['beforeScreenshot', 'afterScreenshot', 'beforeScreenRecording', 'afterScreenRecording'];
    for (const field of fileFields) {
      if (entry[field] && entry[field].publicId) {
        try {
          const resourceType = field.includes('Recording') ? 'video' : 'image';
          console.log(`Deleting Cloudinary file for field ${field}:`, entry[field].publicId, 'resourceType:', resourceType);
          const result = await cloudinary.uploader.destroy(entry[field].publicId, { resource_type: resourceType });
          console.log('Cloudinary destroy result:', result);
        } catch (cloudErr) {
          console.error(`Error deleting Cloudinary file for field ${field}:`, cloudErr);
        }
      }
    }
    await entry.deleteOne();
    console.log('DeleteEntry: Entry deleted for id:', req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DeleteEntry error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create a new journal entry
exports.createEntry = async (req, res) => {
  try {
    // Debug logs for troubleshooting
    console.log('Journal createEntry req.body:', req.body);
    console.log('type:', req.body.type);
    console.log('strategy:', req.body.strategy);
    console.log('emotions:', req.body.emotions);
    // Accept all fields as JSON, including file URLs/publicIds
    const { type, pair, strategy, emotions, confluences, beforeScreenshot, afterScreenshot, beforeScreenRecording, afterScreenRecording, outcome, timeEntered, timeAfterPlayout } = req.body;
    if (!type || !pair || !strategy || !emotions) {
      console.log('Missing required fields:', { type, pair, strategy, emotions });
      return res.status(400).json({ error: 'Trade Type, Pair, Strategy, and Emotions are required.' });
    }
    const entryData = {
      type,
      pair,
      strategy,
      emotions,
      confluences,
      beforeScreenshot,
      afterScreenshot,
      beforeScreenRecording,
      afterScreenRecording,
      outcome,
      timeEntered,
      timeAfterPlayout,
      userId: req.user.id,
      date: new Date(),
    };
    const entry = new JournalEntry(entryData);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    console.log('Journal createEntry error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Get all journal entries for the authenticated user (with pagination)
exports.getEntries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 4;
    const query = { userId: req.user.id };
    const total = await JournalEntry.countDocuments(query);
    const entries = await JournalEntry.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    res.json({ entries, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
