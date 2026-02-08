// Get a badge payment by ID
exports.getBadgePaymentById = async (req, res) => {
  try {
    const paymentId = req.params.id;
    if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });
    const payment = await BadgePayment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
const BadgePayment = require('../models/BadgePayment');
const User = require('../models/User');
const axios = require('axios');
const { requireAuth } = require("../middleware/auth");
const Notification = require("../models/Notification");

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
            // Update all previous completed badge payments to have the latest periodStart and periodEnd
            await BadgePayment.updateMany(
                {
                    user: badgePayment.user,
                    type: 'verified_badge',
                    status: 'completed',
                    _id: { $ne: badgePayment._id }
                },
                {
                    periodStart: badgePayment.periodStart,
                    periodEnd: badgePayment.periodEnd
                }
            );
        }
        res.status(201).json(badgePayment);
    } catch (err) {
        console.error('Create badge payment error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Sync User.verified with badge payment state: true if any payment has periodEnd in future, false otherwise
exports.expireOldBadgePayments = async () => {
  const now = new Date();
  // Get distinct users who have completed verified_badge payments
  const userIds = await BadgePayment.distinct('user', {
    status: 'completed',
    type: 'verified_badge'
  });
  for (const userId of userIds) {
    // Does this user have ANY completed badge payment with periodEnd in the future?
    const hasActiveBadge = await BadgePayment.exists({
      user: userId,
      status: 'completed',
      type: 'verified_badge',
      periodEnd: { $exists: true, $gt: now }
    });
    await User.findByIdAndUpdate(userId, { verified: !!hasActiveBadge });
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
        // Store billingType so PayHero callback can set correct periodEnd (30 days monthly, 365 days annual)
        const normalizedBillingType = (billingType === 'annual') ? 'annual' : 'monthly';
        // Save attempt in DB (status: pending); return _id so client can poll for real result
        const badgePayment = await BadgePayment.create({
            user: userId,
            username, // Store username as top-level field
            type: 'verified_badge',
            amount,
            currency: 'KES',
            paymentMethod: 'mpesa',
            status: 'pending',
            methodDetails: { phone_number, billingType: normalizedBillingType },
            transactionId: response.data.CheckoutRequestID,
            rawResponse: response.data,
            serviceDetails: { external_reference },
            mpesaCode: null, // Add for easier viewing
            externalReference: external_reference // Add for easier viewing
            // Do NOT set periodStart or periodEnd here
        });
        // Return PayHero payload plus _id so UI can poll GET /badge-payments/:id for final status
        res.json({ ...response.data, _id: badgePayment._id.toString() });
    } catch (err) {
        console.error('STK push error:', err);
        res.status(500).json({ error: err.message });
    }
};

// PayHero callback handler
exports.payheroCallback = async (req, res) => {
    try {
        const data = req.body.response || req.body;
        const transactionId = data.CheckoutRequestID || data.CheckoutRequestId || data.transactionId;
        const paymentDoc = await BadgePayment.findOne({ transactionId });
        if (!paymentDoc) {
            console.warn('PayHero callback: no payment found for transactionId:', transactionId);
            return res.json({ success: true });
        }
        // Get billingType from frontend-stored data: monthly = 30 days, annual = 365 days
        const billingType = (paymentDoc.methodDetails?.billingType === 'annual') ? 'annual' : 'monthly';
        // Find and update the payment by transactionId
        let update = {
            status: data.Status === 'Success' ? 'completed' : 'failed',
            rawResponse: data,
            methodDetails: {
                ...(paymentDoc.methodDetails && typeof paymentDoc.methodDetails === 'object' ? paymentDoc.methodDetails : {}),
                MpesaReceiptNumber: data.MpesaReceiptNumber,
                ResultDesc: data.ResultDesc
            },
            mpesaCode: data.MpesaReceiptNumber || null, // Store M-Pesa code at top level
            serviceDetails: { external_reference: data.ExternalReference || data.external_reference },
            externalReference: data.ExternalReference || data.external_reference || null
        };
        // Only set periodStart and periodEnd if payment is successful
        if (data.Status === 'Success') {
            const now = new Date();
            const periodStart = now;
            const periodEnd = billingType === 'annual'
                ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)  // 365 days
                : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);   // 30 days
            update.periodStart = periodStart;
            update.periodEnd = periodEnd;
        } else {
            update.periodStart = undefined;
            update.periodEnd = undefined;
        }
        const payment = await BadgePayment.findOneAndUpdate(
            { transactionId },
            update,
            { new: true }
        );
        // Send notification for both success and failure, using professional language and best failure reason
        if (payment) {
          const userDoc = await User.findById(payment.user);
          const reason = payment.type === "verified_badge"
            ? "Blue Badge subscription"
            : payment.type
              ? `${payment.type.charAt(0).toUpperCase() + payment.type.slice(1)} badge subscription`
              : "badge subscription";
          let message;
          if (data.Status === 'Success') {
            message = `Dear ${userDoc.username}, your payment of ${payment.currency || "KES"} ${payment.amount} for ${reason} was successful. Thank you for your subscription.`;
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
            message = `Dear ${userDoc.username}, your payment of ${payment.currency || "KES"} ${payment.amount} for ${reason} was not successful. Reason: ${failureReason || 'Unknown error'}. Please try again or contact support if the issue persists.`;
          }
          await Notification.create({
            user: payment.user,
            type: "badge_payment",
            message,
            read: false,
            payment: payment._id,
          });
        }
        if (payment && data.Status === 'Success') {
            await User.findByIdAndUpdate(payment.user, { verified: true });
            // Update all previous completed badge payments to have the latest periodStart and periodEnd
            await BadgePayment.updateMany(
                {
                    user: payment.user,
                    type: 'verified_badge',
                    status: 'completed',
                    _id: { $ne: payment._id }
                },
                {
                    periodStart: payment.periodStart,
                    periodEnd: payment.periodEnd
                }
            );
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get payment status by paymentId (for polling after STK push; same shape as journal-payments/status)
exports.getBadgePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.query;
    if (!paymentId) return res.status(400).json({ error: 'paymentId is required' });
    const payment = await BadgePayment.findById(paymentId).populate('user', 'username');
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    const userId = req.user && req.user.id;
    const paymentUserId = payment.user && (payment.user._id ? payment.user._id.toString() : payment.user.toString());
    if (paymentUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this payment' });
    }
    const failureReason = payment.status === 'failed'
      ? (payment.methodDetails?.ResultDesc || payment.rawResponse?.ResultDesc || 'Payment failed or cancelled.')
      : null;
    return res.json({ status: payment.status, payment, failureReason });
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
