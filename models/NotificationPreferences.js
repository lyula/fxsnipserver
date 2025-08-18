const mongoose = require('mongoose');

const NotificationPreferencesSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  push: { type: Boolean, default: true },
  pushTypes: {
    comment: { type: Boolean, default: true },
    reply: { type: Boolean, default: true },
    like: { type: Boolean, default: true },
    mention: { type: Boolean, default: true },
    message: { type: Boolean, default: true }
  },
  email: { type: Boolean, default: false },
  sms: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationPreferences', NotificationPreferencesSchema);
