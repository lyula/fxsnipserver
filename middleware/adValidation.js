const { validationResult } = require('express-validator');
const Ad = require('../models/Ad');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

// Middleware to check if user can create ads
const canCreateAd = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user has too many pending ads
    const pendingAdsCount = await Ad.countDocuments({
      userId,
      status: { $in: ['pending_approval', 'pending_payment'] }
    });

    if (pendingAdsCount >= 5) { // Max 5 pending ads
      return res.status(429).json({
        success: false,
        message: 'You have too many pending ads. Please complete or cancel existing ads before creating new ones.'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking ad creation permissions',
      error: error.message
    });
  }
};

// Middleware to check if user owns the ad
const checkAdOwnership = async (req, res, next) => {
  try {
    const adId = req.params.id;
    const userId = req.user.id;
    
    const ad = await Ad.findById(adId);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this ad'
      });
    }

    req.ad = ad; // Attach ad to request for use in controller
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking ad ownership',
      error: error.message
    });
  }
};

// Middleware to check if ad can be modified
const canModifyAd = (req, res, next) => {
  const ad = req.ad; // Assumes checkAdOwnership was called first
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }

  // Only drafts and rejected ads can be modified
  if (!['draft', 'rejected'].includes(ad.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot modify ad with status: ${ad.status}`
    });
  }

  next();
};

// Middleware to check if ad can be deleted
const canDeleteAd = (req, res, next) => {
  const ad = req.ad; // Assumes checkAdOwnership was called first
  
  if (!ad) {
    return res.status(404).json({
      success: false,
      message: 'Ad not found'
    });
  }

  // Only drafts, rejected, and completed ads can be deleted
  if (!['draft', 'rejected', 'completed', 'cancelled'].includes(ad.status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete ad with status: ${ad.status}. Active ads must be cancelled first.`
    });
  }

  next();
};

// Middleware to validate targeting data
const validateTargeting = (req, res, next) => {
  const { targeting } = req.body;
  
  if (!targeting) {
    return res.status(400).json({
      success: false,
      message: 'Targeting information is required'
    });
  }

  if (targeting.type === 'country' && !targeting.countries?.length) {
    return res.status(400).json({
      success: false,
      message: 'Country targeting requires at least one country to be selected'
    });
  }

  if (targeting.type === 'global' && targeting.countries?.length) {
    return res.status(400).json({
      success: false,
      message: 'Global targeting cannot specify individual countries'
    });
  }

  next();
};

// Middleware to validate schedule dates
const validateSchedule = (req, res, next) => {
  const { schedule } = req.body;
  
  if (!schedule) {
    return res.status(400).json({
      success: false,
      message: 'Schedule information is required'
    });
  }

  const startDate = new Date(schedule.startDate);
  const endDate = new Date(schedule.endDate);
  const now = new Date();

  if (startDate < now) {
    return res.status(400).json({
      success: false,
      message: 'Start date cannot be in the past'
    });
  }

  if (endDate <= startDate) {
    return res.status(400).json({
      success: false,
      message: 'End date must be after start date'
    });
  }

  const durationInDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  if (durationInDays < 1) {
    return res.status(400).json({
      success: false,
      message: 'Ad must run for at least 1 day'
    });
  }

  if (durationInDays > 365) {
    return res.status(400).json({
      success: false,
      message: 'Ad cannot run for more than 365 days'
    });
  }

  next();
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Rate limiting for ad creation
const createAdRateLimit = (req, res, next) => {
  // In a production environment, you might use Redis for this
  // For now, this is a placeholder that would integrate with your rate limiting solution
  next();
};

module.exports = {
  handleValidationErrors,
  canCreateAd,
  checkAdOwnership,
  canModifyAd,
  canDeleteAd,
  validateTargeting,
  validateSchedule,
  requireAdmin,
  createAdRateLimit
};
