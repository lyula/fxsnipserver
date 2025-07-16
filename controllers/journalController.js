// Update a journal entry
exports.updateEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    Object.assign(entry, req.body);
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
const JournalEntry = require('../models/JournalEntry');

// Create a new journal entry
exports.createEntry = async (req, res) => {
  try {
    const cloudinaryUpload = require('../utils/cloudinaryUpload');
    const entryData = {
      ...req.body,
      userId: req.user._id,
      date: new Date(),
    };
    // Handle file uploads (if using multer, files will be in req.files)
    if (req.files) {
      // Helper to upload and get Cloudinary URL
      const uploadToCloudinary = async (file, folder) => {
        if (!file) return null;
        const result = await cloudinaryUpload(file.path, folder);
        return {
          url: result.secure_url,
          publicId: result.public_id
        };
      };
      if (req.files.beforeScreenshot) {
        entryData.beforeScreenshot = await uploadToCloudinary(req.files.beforeScreenshot[0], 'journals');
      }
      if (req.files.afterScreenshot) {
        entryData.afterScreenshot = await uploadToCloudinary(req.files.afterScreenshot[0], 'journals');
      }
      if (req.files.beforeScreenRecording) {
        entryData.beforeScreenRecording = await uploadToCloudinary(req.files.beforeScreenRecording[0], 'journals');
      }
      if (req.files.afterScreenRecording) {
        entryData.afterScreenRecording = await uploadToCloudinary(req.files.afterScreenRecording[0], 'journals');
      }
    }
    const entry = new JournalEntry(entryData);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
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
