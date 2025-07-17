const JournalPayment = require('../models/JournalPayment');
const axios = require('axios');

// Create a new journal payment and initiate STK push
exports.createJournalPayment = async (req, res) => {
  try {
    const { amount, phone, journalType } = req.body;
    const userId = req.user.id;
    const channel = process.env.PAYHERO_JOURNAL_CHANNEL_ID;

    // Create payment record (pending)
    const payment = new JournalPayment({
      userId,
      amount,
      currency: 'USD',
      channel,
      status: 'pending',
      phone,
      journalType
    });
    await payment.save();

    // Initiate STK push via Payhero
    const payheroRes = await axios.post(
      `${process.env.BASE_URL}/api/payhero/stkpush`,
      {
        amount,
        phone,
        channelId: channel,
        paymentId: payment._id,
        journalType
      },
      {
        headers: {
          Authorization: process.env.PAYHERO_BASIC_AUTH
        }
      }
    );

    res.status(201).json({ payment, stk: payheroRes.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Callback to update payment status
exports.payheroCallback = async (req, res) => {
  try {
    const { paymentId, status, transactionId, receipt } = req.body;
    const payment = await JournalPayment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    payment.status = status;
    payment.transactionId = transactionId;
    payment.receipt = receipt;
    payment.updatedAt = new Date();
    await payment.save();
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get latest payment for user
exports.getLatestJournalPayment = async (req, res) => {
  try {
    const payment = await JournalPayment.findOne({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all payments for user
exports.getAllJournalPayments = async (req, res) => {
  try {
    const payments = await JournalPayment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
