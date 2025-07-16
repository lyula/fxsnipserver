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
    const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    // Update outcome and after-trade files
    if (req.body.outcome) entry.outcome = req.body.outcome;
    if (req.body.timeAfterPlayout) entry.timeAfterPlayout = req.body.timeAfterPlayout;
    if (req.files) {
      if (req.files.afterScreenshot) {
        const result = await cloudinary.uploader.upload(
          req.files.afterScreenshot[0].path,
          { folder: 'journals', resource_type: 'image' }
        );
        entry.afterScreenshot = { url: result.secure_url, publicId: result.public_id };
      }
      if (req.files.afterScreenRecording) {
        const result = await cloudinary.uploader.upload(
          req.files.afterScreenRecording[0].path,
          { folder: 'journals', resource_type: 'video' }
        );
        entry.afterScreenRecording = { url: result.secure_url, publicId: result.public_id };
      }
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
    const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    const cloudinary = require('cloudinary').v2;
    // Remove files from Cloudinary if publicId exists
    const fileFields = ['beforeScreenshot', 'afterScreenshot', 'beforeScreenRecording', 'afterScreenRecording'];
    for (const field of fileFields) {
      if (entry[field] && entry[field].publicId) {
        await cloudinary.uploader.destroy(entry[field].publicId, { resource_type: field.includes('Recording') ? 'video' : 'image' });
      }
    }
    await entry.deleteOne();
    res.json({ success: true });
  } catch (err) {
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
    const { type, strategy, emotions, confluences, beforeScreenshot, afterScreenshot, beforeScreenRecording, afterScreenRecording, outcome, timeEntered, timeAfterPlayout } = req.body;
    if (!type || !strategy || !emotions) {
      console.log('Missing required fields:', { type, strategy, emotions });
      return res.status(400).json({ error: 'Trade Type, Strategy, and Emotions are required.' });
    }
    const entryData = {
      type,
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
      userId: req.user._id,
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
    const query = { userId: req.user._id };
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
