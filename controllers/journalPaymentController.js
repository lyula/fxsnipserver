// Get payment status by paymentId (for polling from frontend)
exports.getJournalPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.query;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });
    const payment = await JournalPayment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    // Try to get the most accurate failure reason (ResultDesc from callback, or fallback)
    let failureReason = payment.failureReason;
    if (!failureReason && payment && payment.status === 'failed' && payment.receipt == null && payment.transactionId) {
      // Try to get last known ResultDesc from payment (if stored in a future version)
      failureReason = 'Payment was not completed or was cancelled.';
    }
    return res.json({ status: payment.status, payment, failureReason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const JournalPayment = require('../models/JournalPayment');
const axios = require('axios');

// Create a new journal payment and initiate STK push (PayHero)
exports.createJournalPayment = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    const userDoc = userId ? await require('../models/User').findById(userId) : null;
    const username = userDoc ? userDoc.username : undefined;
    // Always treat amount as KES from frontend
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
    // Set period and periodStart/periodEnd based on billingType
    const now = new Date();
    let period = 'monthly';
    let periodStart = now;
    let periodEnd;
    if (billingType === 'annual') {
      period = 'annual';
      periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    const channel_id = process.env.PAYHERO_JOURNAL_CHANNEL_ID;
    const callback_url = `${process.env.BASE_URL}/api/journal-payments/payhero-callback`;
    const external_reference = `JOURNAL-${Date.now()}`;
    let response;
    try {
      response = await axios.post(
        'https://backend.payhero.co.ke/api/v2/payments',
        {
          amount: Number(amount), // Always use the KES amount from frontend
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
    const paymentDoc = await JournalPayment.create({
      userId,
      username, // Store username at time of payment
      amount: Number(amount), // Always use the KES amount from frontend
      currency: 'KES',
      channel: channel_id,
      status: 'pending',
      phone: phone_number,
      journalType,
      period,
      periodStart,
      periodEnd,
      transactionId: response.data.CheckoutRequestID,
      receipt: null
    });
    // Only return success if PayHero accepted the request
    if (response.data && response.data.ResponseCode === '0') {
      return res.status(200).json({ success: true, data: { ...response.data, _id: paymentDoc._id } });
    } else {
      return res.status(200).json({ success: false, message: 'Payment Failed', data: { ...response.data, _id: paymentDoc._id } });
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
      updatedAt: new Date(),
      failureReason: data.Status === 'Success' ? undefined : (data.ResultDesc || 'Unknown error')
    };
    // Only set period and periodEnd if payment is successful
    if (data.Status === 'Success') {
      let period = 'monthly';
      let periodStart = new Date();
      let periodEnd;
      const paymentDoc = await JournalPayment.findOne({ transactionId: data.CheckoutRequestID });
      if (paymentDoc && paymentDoc.period) {
        period = paymentDoc.period;
      }
      if (paymentDoc && paymentDoc.periodStart) {
        periodStart = paymentDoc.periodStart;
      }
      if (period === 'annual') {
        periodEnd = new Date(periodStart.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
      }
      update.period = period;
      update.periodStart = periodStart;
      update.periodEnd = periodEnd;
    } else {
      update.period = undefined;
      update.periodStart = undefined;
      update.periodEnd = undefined;
    }
    const payment = await JournalPayment.findOneAndUpdate(
      { transactionId: data.CheckoutRequestID },
      update,
      { new: true }
    );
    // Send notification for both success and failure, using professional language and best failure reason
    if (payment) {
      const User = require('../models/User');
      const Notification = require('../models/Notification');
      const userDoc = await User.findById(payment.userId);
      const reason = payment.journalType ? `${payment.journalType} journal subscription` : 'journal subscription';
      let message;
      if (data.Status === 'Success') {
        message = `Dear ${userDoc.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was successful. Thank you for your subscription.`;
      } else {
        // Try to get the most informative failure reason
        let failureReason = null;
        if (data.ResultDesc || data.resultDesc) {
          failureReason = data.ResultDesc || data.resultDesc;
        } else if (payment.rawResponse && (payment.rawResponse.ResultDesc || payment.rawResponse.resultDesc)) {
          failureReason = payment.rawResponse.ResultDesc || payment.rawResponse.resultDesc;
        } else if (payment.methodDetails && (payment.methodDetails.ResultDesc || payment.methodDetails.resultDesc)) {
          failureReason = payment.methodDetails.ResultDesc || payment.methodDetails.resultDesc;
        } else if (payment.failureReason) {
          failureReason = payment.failureReason;
        }
        message = `Dear ${userDoc.username}, your payment of ${payment.currency || 'KES'} ${payment.amount} for ${reason} was not successful. Reason: ${failureReason || 'Unknown error'}. Please try again or contact support if the issue persists.`;
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
    const payment = await JournalPayment.findOne({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: 'username' });
    // Attach username at top level for easier frontend use
    let paymentObj = payment ? payment.toObject() : null;
    if (paymentObj && paymentObj.userId && paymentObj.userId.username) {
      paymentObj.username = paymentObj.userId.username;
    }
    res.json(paymentObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all payments for user

exports.getAllJournalPayments = async (req, res) => {
  try {
    const payments = await JournalPayment.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: 'username' });
    // Attach username at top level for easier frontend use
    const paymentsWithUsername = payments.map(payment => {
      let obj = payment.toObject();
      if (obj.userId && obj.userId.username) {
        obj.username = obj.userId.username;
      }
      return obj;
    });
    res.json(paymentsWithUsername);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
