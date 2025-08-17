const NotificationPreferences = require('../models/NotificationPreferences');

// Get preferences for current user
exports.getPreferences = async (req, res) => {
  try {
    const prefs = await NotificationPreferences.findOne({ user: req.user._id });
    if (!prefs) return res.json({ push: true, email: false, sms: false });
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

// Update preferences for current user
exports.updatePreferences = async (req, res) => {
  try {
    const { push, email, sms } = req.body;
    let prefs = await NotificationPreferences.findOne({ user: req.user._id });
    if (!prefs) {
      prefs = new NotificationPreferences({ user: req.user._id, push, email, sms });
    } else {
      prefs.push = push;
      prefs.email = email;
      prefs.sms = sms;
      prefs.updatedAt = Date.now();
    }
    await prefs.save();
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences' });
  }
};
