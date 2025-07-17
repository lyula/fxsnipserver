const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['Buy', 'Sell'], required: true },
  pair: { type: String, required: true },
  strategy: String,
  emotions: String,
  confluences: String,
  beforeScreenshot: {
    url: String,
    publicId: String
  },
  afterScreenshot: {
    url: String,
    publicId: String
  },
  beforeScreenRecording: {
    url: String,
    publicId: String
  },
  afterScreenRecording: {
    url: String,
    publicId: String
  },
  outcome: { type: String, enum: ['', 'Profit', 'Loss', 'Break Even'], default: '' },
  timeEntered: Date,
  timeAfterPlayout: Date,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('JournalEntry', JournalEntrySchema);
