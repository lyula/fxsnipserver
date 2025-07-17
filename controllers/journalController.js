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

// Create a new journal entry with payment enforcement
const JournalPayment = require('../models/JournalPayment');
exports.createEntry = async (req, res) => {
  try {
    // Debug logs for troubleshooting
    console.log('Journal createEntry req.body:', req.body);
    const userId = req.user.id;
    const { type, pair, strategy, emotions, confluences, beforeScreenshot, afterScreenshot, beforeScreenRecording, afterScreenRecording, outcome, timeEntered, timeAfterPlayout } = req.body;
    if (!type || !pair || !strategy || !emotions) {
      return res.status(400).json({ error: 'Trade Type, Pair, Strategy, and Emotions are required.' });
    }

    // 1. Enforce 1 free journal per month, but allow unlimited if paid (monthly or annual)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const journalCount = await JournalEntry.countDocuments({ userId, date: { $gte: monthStart } });
    // For monthly payments, use 30 days window
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let hasPaidUnlimited = false;
    let hasPaidUnlimitedAnnual = false;
    // Always allow the first journal (excluding screenrecordings) for free each month
    if (journalCount >= 1) {
      // Check for successful unlimited journal payment (monthly: last 30 days, or annual: last 365 days)
      // 1. Monthly (30 days)
      const paidMonthly = await JournalPayment.findOne({
        userId,
        journalType: 'unlimited',
        status: 'success',
        period: 'monthly',
        createdAt: { $gte: thirtyDaysAgo }
      });
      // 2. Annual (within 365 days)
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const paidAnnual = await JournalPayment.findOne({
        userId,
        journalType: 'unlimited',
        status: 'success',
        period: 'annual',
        createdAt: { $gte: yearAgo }
      });
      hasPaidUnlimited = !!paidMonthly || !!paidAnnual;
      hasPaidUnlimitedAnnual = !!paidAnnual;
      // Only enforce payment for unlimited journals if user has already created one this month and is not paying
      if (!hasPaidUnlimited && (!beforeScreenRecording && !afterScreenRecording)) {
        return res.status(402).json({ error: 'You have used your free journal for this month. Please pay $2/month (30 days) or $19.99/year for unlimited journals.' });
      }
    }

    // 2. If uploading screen recording, require screenrecording payment (monthly or annual)
    let hasPaidScreen = false;
    let hasPaidScreenAnnual = false;
    if (beforeScreenRecording || afterScreenRecording) {
      // Monthly (30 days)
      const paidScreenMonthly = await JournalPayment.findOne({
        userId,
        journalType: 'screenrecording',
        status: 'success',
        period: 'monthly',
        createdAt: { $gte: thirtyDaysAgo }
      });
      // Annual (within 365 days)
      const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      const paidScreenAnnual = await JournalPayment.findOne({
        userId,
        journalType: 'screenrecording',
        status: 'success',
        period: 'annual',
        createdAt: { $gte: yearAgo }
      });
      hasPaidScreen = !!paidScreenMonthly || !!paidScreenAnnual;
      hasPaidScreenAnnual = !!paidScreenAnnual;
      if (!hasPaidScreen) {
        return res.status(402).json({ error: 'Screen recordings require a $9.99/month (30 days) or $99.99/year payment.' });
      }
    }

    // 3. If user has paid for screenrecording, allow unlimited screenshots too for the period
    let allowScreenshots = false;
    if (hasPaidScreen) {
      allowScreenshots = true;
    }
    // If user tries to upload screenshots but not paid for unlimited journals or screenrecording, block after 1 free
    if ((beforeScreenshot || afterScreenshot) && journalCount >= 1 && !hasPaidUnlimited && !allowScreenshots) {
      return res.status(402).json({ error: 'Uploading screenshots requires a payment for unlimited journals or screenrecording.' });
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
      userId,
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
