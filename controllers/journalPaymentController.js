const JournalPayment = require('../models/JournalPayment');
const axios = require('axios');

// Create a new journal payment and initiate STK push (PayHero)
exports.createJournalPayment = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const userDoc = userId ? await require('../models/User').findById(userId) : null;
    const username = userDoc ? userDoc.username : undefined;
    const { phone_number, amount, journalType, billingType } = req.body;
    let customer_name = req.body.customer_name || username;
    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    if (!/^2547\d{8}$/.test(phone_number)) {
      return res.status(400).json({ error: 'Phone number must be in format 2547XXXXXXXX' });
    }
    if (!process.env.PAYHERO_JOURNAL_CHANNEL_ID || !process.env.PAYHERO_BASIC_AUTH) {
      return res.status(500).json({ error: 'PayHero credentials not set in environment' });
    }
    // Set period based on billingType
    const now = new Date();
    let period = 'monthly';
    if (billingType === 'annual') period = 'annual';
    const channel_id = process.env.PAYHERO_JOURNAL_CHANNEL_ID;
    const callback_url = `${process.env.BASE_URL}/api/journal-payments/payhero-callback`;
    const external_reference = `JOURNAL-${Date.now()}`;
    let response;
    try {
      response = await axios.post(
        'https://backend.payhero.co.ke/api/v2/payments',
        {
          amount,
          phone_number,
          channel_id: Number(channel_id),
          provider: 'm-pesa',
          external_reference,
          customer_name,
          callback_url
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.PAYHERO_BASIC_AUTH.trim()
          }
        }
      );
    } catch (apiErr) {
      console.error('PayHero API error:', apiErr.response?.data || apiErr.message);
      return res.status(200).json({ success: false, message: 'Payment Failed', details: apiErr.response?.data || apiErr.message });
    }
    // Save attempt in DB (status: pending)
    await JournalPayment.create({
      userId,
      amount,
      currency: 'KES',
      channel: channel_id,
      status: 'pending',
      phone: phone_number,
      journalType,
      period,
      transactionId: response.data.CheckoutRequestID,
      receipt: null
    });
    // Only return success if PayHero accepted the request
    if (response.data && response.data.ResponseCode === '0') {
      return res.status(200).json({ success: true, data: response.data });
    } else {
      return res.status(200).json({ success: false, message: 'Payment Failed', data: response.data });
    }
  } catch (err) {
    console.error('STK push error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Callback to update payment status (aligned with badge payment logic)
exports.payheroCallback = async (req, res) => {
  try {
    const data = req.body.response || req.body;
    // Find and update the payment by transactionId or external_reference
    let update = {
      status: data.Status === 'Success' ? 'success' : 'failed',
      receipt: data.MpesaReceiptNumber || data.receipt || null,
      transactionId: data.CheckoutRequestID || data.transactionId,
      updatedAt: new Date()
    };
    // Only set period if payment is successful
    if (data.Status === 'Success') {
      let period = 'monthly';
      const paymentDoc = await JournalPayment.findOne({ transactionId: data.CheckoutRequestID });
      if (paymentDoc && paymentDoc.period) {
        period = paymentDoc.period;
      }
      update.period = period;
    } else {
      update.period = undefined;
    }
    const payment = await JournalPayment.findOneAndUpdate(
      { transactionId: data.CheckoutRequestID },
      update,
      { new: true }
    );
    // Send notification for both success and failure
    if (payment) {
      const User = require('../models/User');
      const Notification = require('../models/Notification');
      const userDoc = await User.findById(payment.userId);
      const reason = payment.journalType ? `${payment.journalType} journal subscription` : 'journal subscription';
      let message;
      if (data.Status === 'Success') {
        message = `Hey ${userDoc.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was successful!`;
      } else {
        message = `Sorry ${userDoc.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} failed. Reason: ${data.ResultDesc || 'Unknown error'}. Please try again.`;
      }
      await Notification.create({
        user: payment.userId,
        type: 'journal_payment',
        message,
        read: false,
        payment: payment._id
      });
    }
    // Always return payment failed if not successful
    if (data.Status === 'Success') {
      return res.json({ success: true });
    } else {
      return res.json({ success: false, message: 'Payment Failed' });
    }
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
