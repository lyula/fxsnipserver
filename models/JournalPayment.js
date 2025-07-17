const mongoose = require('mongoose');

const JournalPaymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String }, // Store username at time of payment
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  channel: { type: String, required: true }, // e.g. 'payhero', 'mpesa', etc
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  phone: { type: String },
  transactionId: { type: String },
  receipt: { type: String },
  journalType: { type: String, enum: ['unlimited', 'screenrecording'], required: true },
  period: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  failureReason: { type: String }, // Store payment failure reason (e.g., ResultDesc)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

JournalPaymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('JournalPayment', JournalPaymentSchema);
