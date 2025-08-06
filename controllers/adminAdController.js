const Ad = require('../models/Ad');
const User = require('../models/User');

// @desc    Get all ads for admin review
// @route   GET /api/admin/ads
// @access  Private (Admin only)
const getAllAds = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const category = req.query.category;
    const search = req.query.search;

    const query = {};
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const ads = await Ad.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'name email')
      .populate('approvedBy', 'name email');

    const total = await Ad.countDocuments(query);

    // Get statistics
    const stats = await Ad.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalPriceUSD' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        ads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching ads for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ads',
      error: error.message
    });
  }
};

// @desc    Approve an ad
// @route   POST /api/admin/ads/:id/approve
// @access  Private (Admin only)
const approveAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'Can only approve ads with pending payment status'
      });
    }

    ad.approve(req.user._id);
    await ad.save();

    // Populate user info for response
    await ad.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Ad approved successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error approving ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving ad',
      error: error.message
    });
  }
};

// @desc    Reject an ad
// @route   POST /api/admin/ads/:id/reject
// @access  Private (Admin only)
const rejectAd = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'Can only reject ads with pending payment status'
      });
    }

    ad.reject(reason.trim());
    await ad.save();

    // Populate user info for response
    await ad.populate('userId', 'name email');

    res.status(200).json({
      success: true,
      message: 'Ad rejected successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error rejecting ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting ad',
      error: error.message
    });
  }
};

// @desc    Pause an active ad
// @route   POST /api/admin/ads/:id/pause
// @access  Private (Admin only)
const pauseAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Can only pause active ads'
      });
    }

    ad.status = 'paused';
    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Ad paused successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error pausing ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error pausing ad',
      error: error.message
    });
  }
};

// @desc    Resume a paused ad
// @route   POST /api/admin/ads/:id/resume
// @access  Private (Admin only)
const resumeAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Can only resume paused ads'
      });
    }

    // Check if ad hasn't expired
    if (ad.schedule.endDate && ad.schedule.endDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot resume expired ad'
      });
    }

    ad.status = 'active';
    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Ad resumed successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error resuming ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error resuming ad',
      error: error.message
    });
  }
};

// @desc    Update ad performance metrics
// @route   PUT /api/admin/ads/:id/performance
// @access  Private (Admin only)
const updateAdPerformance = async (req, res) => {
  try {
    const { impressions, clicks, reach, engagement } = req.body;

    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Update performance metrics
    if (impressions !== undefined) ad.performance.impressions = impressions;
    if (clicks !== undefined) ad.performance.clicks = clicks;
    if (reach !== undefined) ad.performance.reach = reach;
    if (engagement !== undefined) ad.performance.engagement = engagement;

    // Calculate click-through rate
    if (ad.performance.impressions > 0) {
      ad.performance.clickThroughRate = (ad.performance.clicks / ad.performance.impressions) * 100;
    }

    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Ad performance updated successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error updating ad performance:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ad performance',
      error: error.message
    });
  }
};

// @desc    Get ad analytics/dashboard data
// @route   GET /api/admin/ads/analytics
// @access  Private (Admin only)
const getAdAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = {};
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Overall statistics
    const overallStats = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalAds: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalPriceUSD' },
          totalImpressions: { $sum: '$performance.impressions' },
          totalClicks: { $sum: '$performance.clicks' },
          avgCTR: { $avg: '$performance.clickThroughRate' }
        }
      }
    ]);

    // Status breakdown
    const statusBreakdown = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalPriceUSD' }
        }
      }
    ]);

    // Category breakdown
    const categoryBreakdown = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalPriceUSD' },
          avgCTR: { $avg: '$performance.clickThroughRate' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Daily statistics for charts
    const dailyStats = await Ad.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          adsCreated: { $sum: 1 },
          revenue: { $sum: '$pricing.totalPriceUSD' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top performing ads
    const topAds = await Ad.find(matchStage)
      .sort({ 'performance.clickThroughRate': -1 })
      .limit(10)
      .populate('userId', 'name email')
      .select('title category performance pricing.totalPriceUSD');

    res.status(200).json({
      success: true,
      data: {
        overview: overallStats[0] || {
          totalAds: 0,
          totalRevenue: 0,
          totalImpressions: 0,
          totalClicks: 0,
          avgCTR: 0
        },
        statusBreakdown,
        categoryBreakdown,
        dailyStats,
        topAds
      }
    });

  } catch (error) {
    console.error('Error fetching ad analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

module.exports = {
  getAllAds,
  approveAd,
  rejectAd,
  pauseAd,
  resumeAd,
  updateAdPerformance,
  getAdAnalytics
};
