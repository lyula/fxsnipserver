const mongoose = require('mongoose');

const BadgePaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String }, // Denormalized username
  type: {
    type: String,
    enum: ['verified_badge', 'signals', 'ads', 'journal'],
    required: true
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'stripe', 'visa', 'mastercard', 'mpesa'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
    required: true
  },
  methodDetails: { type: Object },
  serviceDetails: { type: Object },
  transactionId: { type: String },
  rawResponse: { type: Object },
  periodStart: { type: Date }, // For subscriptions
  periodEnd: { type: Date },   // For subscriptions
  mpesaCode: { type: String }, // Top-level M-Pesa code
  externalReference: { type: String }, // Top-level external reference
}, { timestamps: true });

module.exports = mongoose.model('BadgePayment', BadgePaymentSchema);
