const mongoose = require('mongoose');

const NotificationPreferencesSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  push: { type: Boolean, default: true },
  email: { type: Boolean, default: false },
  sms: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationPreferences', NotificationPreferencesSchema);
