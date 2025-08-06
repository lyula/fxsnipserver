const Ad = require('../models/Ad');
const User = require('../models/User');

// Mock payment processing - replace with actual payment gateway (Stripe, PayPal, etc.)
const processPayment = async (amount, currency, paymentMethod, userInfo) => {
  // This is a mock implementation
  // In production, integrate with actual payment gateways
  
  try {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock success response
    return {
      success: true,
      transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      paymentId: `pay_${Date.now()}`,
      amount,
      currency,
      status: 'completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// @desc    Process payment for an ad
// @route   POST /api/payments/ads/:id/pay
// @access  Private
const processAdPayment = async (req, res) => {
  try {
    const { paymentMethod, cardDetails } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment method is required'
      });
    }

    const ad = await Ad.findById(req.params.id).populate('userId');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user owns the ad
    if (ad.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay for this ad'
      });
    }

    // Check if ad is in correct status for payment
    if (ad.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'Ad is not ready for payment'
      });
    }

    // Check if payment already processed
    if (ad.paymentInfo.paymentStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Payment already completed for this ad'
      });
    }

    // Process payment
    const paymentResult = await processPayment(
      ad.pricing.totalPriceUSD,
      'USD',
      paymentMethod,
      {
        userId: ad.userId._id,
        userName: ad.userId.name,
        userEmail: ad.userId.email
      }
    );

    if (!paymentResult.success) {
      // Update payment status to failed
      ad.paymentInfo.paymentStatus = 'failed';
      await ad.save();

      return res.status(400).json({
        success: false,
        message: 'Payment processing failed',
        error: paymentResult.error
      });
    }

    // Update ad with payment information
    ad.paymentInfo = {
      paymentId: paymentResult.paymentId,
      paymentStatus: 'completed',
      paymentMethod,
      transactionId: paymentResult.transactionId,
      paidAt: new Date()
    };

    // Activate the ad if it's approved
    if (ad.isApproved) {
      ad.activate();
    }

    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        ad,
        payment: {
          transactionId: paymentResult.transactionId,
          amount: paymentResult.amount,
          currency: paymentResult.currency,
          status: paymentResult.status
        }
      }
    });

  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  }
};

// @desc    Get payment history for user
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const ads = await Ad.find({
      userId: req.user._id,
      'paymentInfo.paymentStatus': 'completed'
    })
      .sort({ 'paymentInfo.paidAt': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('title category pricing paymentInfo schedule status');

    const total = await Ad.countDocuments({
      userId: req.user._id,
      'paymentInfo.paymentStatus': 'completed'
    });

    // Calculate total spent
    const totalSpent = await Ad.aggregate([
      {
        $match: {
          userId: req.user._id,
          'paymentInfo.paymentStatus': 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalPriceUSD' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments: ads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        totalSpent: totalSpent[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history',
      error: error.message
    });
  }
};

// @desc    Refund payment for an ad
// @route   POST /api/payments/ads/:id/refund
// @access  Private (Admin only)
const refundAdPayment = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Refund reason is required'
      });
    }

    const ad = await Ad.findById(req.params.id).populate('userId');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if payment was completed
    if (ad.paymentInfo.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'No completed payment found for this ad'
      });
    }

    // Check if already refunded
    if (ad.paymentInfo.paymentStatus === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Payment already refunded'
      });
    }

    // Process refund (mock implementation)
    const refundResult = await processRefund(
      ad.paymentInfo.transactionId,
      ad.pricing.totalPriceUSD,
      reason
    );

    if (!refundResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Refund processing failed',
        error: refundResult.error
      });
    }

    // Update ad status
    ad.paymentInfo.paymentStatus = 'refunded';
    ad.status = 'cancelled';
    ad.rejectionReason = `Refunded: ${reason}`;
    
    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// Mock refund processing
const processRefund = async (transactionId, amount, reason) => {
  try {
    // Simulate refund processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      refundId: `ref_${Date.now()}`,
      amount,
      reason
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// @desc    Get payment statistics for admin
// @route   GET /api/payments/admin/stats
// @access  Private (Admin only)
const getPaymentStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = {
      'paymentInfo.paymentStatus': 'completed'
    };
    
    if (Object.keys(dateFilter).length > 0) {
      matchStage['paymentInfo.paidAt'] = dateFilter;
    }

    const stats = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalPriceUSD' },
          totalTransactions: { $sum: 1 },
          avgTransactionValue: { $avg: '$pricing.totalPriceUSD' }
        }
      }
    ]);

    // Revenue by category
    const categoryRevenue = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          revenue: { $sum: '$pricing.totalPriceUSD' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { revenue: -1 } }
    ]);

    // Daily revenue
    const dailyRevenue = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentInfo.paidAt' } },
          revenue: { $sum: '$pricing.totalPriceUSD' },
          transactions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalRevenue: 0,
          totalTransactions: 0,
          avgTransactionValue: 0
        },
        categoryRevenue,
        dailyRevenue
      }
    });

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

module.exports = {
  processAdPayment,
  getPaymentHistory,
  refundAdPayment,
  getPaymentStats
};
