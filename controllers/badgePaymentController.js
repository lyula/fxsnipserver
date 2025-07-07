const BadgePayment = require('../models/BadgePayment');
const User = require('../models/User');
const axios = require('axios');
const requireAuth = require("../middleware/auth");

// Create a badge payment
exports.createBadgePayment = async (req, res) => {
    try {
        // Use authenticated user from JWT, not from body
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { type, amount, currency, paymentMethod, methodDetails, serviceDetails, transactionId, rawResponse, periodStart, periodEnd, status } = req.body;
        if (!type || !amount || !currency || !paymentMethod || !status) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }
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
    } catch (err) {
        console.error('Create badge payment error:', err);
        res.status(500).json({ error: err.message });
    }
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
        console.log('STK push request body:', req.body);
        // Use authenticated user from JWT, not from body
        const userId = req.user && req.user.id;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { phone_number, amount, customer_name } = req.body;
        if (!phone_number || !amount || !customer_name) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }
        const channel_id = process.env.PAYHERO_CHANNEL_ID;
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
                    'Authorization': process.env.PAYHERO_BASIC_AUTH.trim()
                }
            }
        );
        // Save attempt in DB (status: pending)
        await BadgePayment.create({
            user: userId,
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
        console.error('STK push error:', err);
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
