const BadgePayment = require('../models/BadgePayment');
const User = require('../models/User');
const axios = require('axios');

// Create a badge payment
exports.createBadgePayment = async (req, res) => {
    const { userId, type, amount, currency, paymentMethod, methodDetails, serviceDetails, transactionId, rawResponse, periodStart, periodEnd, status } = req.body;
    const badgePayment = await BadgePayment.create({
      user: userId,
      type,
      amount,
      currency,
      paymentMethod,
      methodDetails,
      serviceDetails,
      transactionId,
      rawResponse,
      periodStart,
      periodEnd,
      status
    });
    // If payment is for verified badge and successful, update user
    if (badgePayment.type === 'verified_badge' && badgePayment.status === 'completed') {
        await User.findByIdAndUpdate(badgePayment.user, { verified: true });
    }
    res.status(201).json(badgePayment);
};

// Find all completed badge payments where periodEnd has passed
exports.expireOldBadgePayments = async () => {
  const expiredBadgePayments = await BadgePayment.find({
    status: 'completed',
    type: 'verified_badge',
    periodEnd: { $lt: new Date() }
  });
  for (const badgePayment of expiredBadgePayments) {
    await User.findByIdAndUpdate(badgePayment.user, { verified: false });
    // Optionally, mark payment as expired
    // await BadgePayment.findByIdAndUpdate(badgePayment._id, { status: 'expired' });
  }
};

// Initiate PayHero STK Push
exports.initiateSTKPush = async (req, res) => {
    try {
        const { phone_number, amount, customer_name } = req.body;
        const channel_id = process.env.CHANNEL_ID;
        const callback_url = `${process.env.BASE_URL || 'https://yourdomain.com'}/api/badge-payments/payhero-callback`;
        const external_reference = `BADGE-${Date.now()}`;
        const response = await axios.post(
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
                    'Authorization': process.env.BasicAuth.trim()
                }
            }
        );
        // Save attempt in DB (status: pending)
        await BadgePayment.create({
            user: req.body.userId,
            type: 'verified_badge',
            amount,
            currency: 'KES',
            paymentMethod: 'mpesa',
            status: 'pending',
            methodDetails: { phone_number },
            transactionId: response.data.CheckoutRequestID,
            rawResponse: response.data,
            serviceDetails: { external_reference }
        });
        res.json(response.data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PayHero callback handler
exports.payheroCallback = async (req, res) => {
    try {
        const data = req.body.response || req.body;
        // Find and update the payment by transactionId or external_reference
        const payment = await BadgePayment.findOneAndUpdate(
            { transactionId: data.CheckoutRequestID },
            {
                status: data.Status === 'Success' ? 'completed' : 'failed',
                rawResponse: data,
                methodDetails: { MpesaReceiptNumber: data.MpesaReceiptNumber, ResultDesc: data.ResultDesc }
            },
            { new: true }
        );
        if (payment && data.Status === 'Success') {
            await User.findByIdAndUpdate(payment.user, { verified: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
