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
        // Fetch username for denormalization
        const userDoc = await User.findById(userId);
        const username = userDoc ? userDoc.username : undefined;
        const { type, amount, currency, paymentMethod, methodDetails, serviceDetails, transactionId, rawResponse, periodStart, periodEnd, status, mpesaCode, externalReference } = req.body;
        if (!type || !amount || !currency || !paymentMethod || !status) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }
        const badgePayment = await BadgePayment.create({
            user: userId,
            username, // Store username as top-level field
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
            status,
            mpesaCode: mpesaCode || null,
            externalReference: externalReference || null
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
        // Use authenticated user from JWT, not from body
        const userId = req.user && req.user.id;
        const userDoc = await User.findById(userId);
        const username = userDoc ? userDoc.username : undefined;
        const { phone_number, amount, customer_name, billingType } = req.body;
        if (!phone_number || !amount || !customer_name) {
            return res.status(400).json({ error: 'Missing required payment fields' });
        }
        if (!/^2547\d{8}$/.test(phone_number)) {
            return res.status(400).json({ error: 'Phone number must be in format 2547XXXXXXXX' });
        }
        if (!process.env.PAYHERO_CHANNEL_ID || !process.env.PAYHERO_BASIC_AUTH) {
            return res.status(500).json({ error: 'PayHero credentials not set in environment' });
        }
        // Set periodStart and periodEnd based on billingType
        const now = new Date();
        let periodStart = now;
        let periodEnd;
        if (billingType === 'annual') {
            periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        } else {
            periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        const channel_id = process.env.PAYHERO_CHANNEL_ID;
        const callback_url = `${process.env.BASE_URL || 'https://yourdomain.com'}/api/badge-payments/payhero-callback`;
        const external_reference = `BADGE-${Date.now()}`;
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
            return res.status(502).json({ error: 'PayHero API error', details: apiErr.response?.data || apiErr.message });
        }
        // Save attempt in DB (status: pending)
        await BadgePayment.create({
            user: userId,
            username, // Store username as top-level field
            type: 'verified_badge',
            amount,
            currency: 'KES',
            paymentMethod: 'mpesa',
            status: 'pending',
            methodDetails: { phone_number },
            transactionId: response.data.CheckoutRequestID,
            rawResponse: response.data,
            serviceDetails: { external_reference },
            mpesaCode: null, // Add for easier viewing
            externalReference: external_reference // Add for easier viewing
            // Do NOT set periodStart or periodEnd here
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
        let update = {
            status: data.Status === 'Success' ? 'completed' : 'failed',
            rawResponse: data,
            methodDetails: { MpesaReceiptNumber: data.MpesaReceiptNumber, ResultDesc: data.ResultDesc },
            mpesaCode: data.MpesaReceiptNumber || null, // Store M-Pesa code at top level
            serviceDetails: { external_reference: data.ExternalReference || data.external_reference },
            externalReference: data.ExternalReference || data.external_reference || null
        };
        // Only set periodStart and periodEnd if payment is successful
        if (data.Status === 'Success') {
            const now = new Date();
            let periodStart = now;
            let periodEnd;
            // Try to get billingType from payment or fallback to 30 days
            const paymentDoc = await BadgePayment.findOne({ transactionId: data.CheckoutRequestID });
            let billingType = 'monthly';
            if (paymentDoc && paymentDoc.methodDetails && paymentDoc.methodDetails.billingType) {
                billingType = paymentDoc.methodDetails.billingType;
            }
            if (billingType === 'annual') {
                periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            } else {
                periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            }
            update.periodStart = periodStart;
            update.periodEnd = periodEnd;
        } else {
            update.periodStart = undefined;
            update.periodEnd = undefined;
        }
        const payment = await BadgePayment.findOneAndUpdate(
            { transactionId: data.CheckoutRequestID },
            update,
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

// Get latest badge payment for current user
exports.getLatestBadgePayment = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const payment = await BadgePayment.findOne({ user: userId, type: 'verified_badge' })
      .sort({ createdAt: -1 })
      .populate('user', 'username'); // Populate username
    if (!payment) return res.status(404).json({ error: 'No payment found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all badge payments for current user (history)
exports.getAllBadgePayments = async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });
    const payments = await BadgePayment.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all badge payments (admin)
exports.getAllBadgePaymentsAdmin = async (req, res) => {
  try {
    const payments = await BadgePayment.find({})
      .sort({ createdAt: -1 })
      .populate('user', 'username');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Optionally, update other fetch endpoints to populate user.username as well
