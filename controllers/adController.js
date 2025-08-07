const Ad = require('../models/Ad');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Finance CPM (cost per 1000 views) in USD (should match frontend)
const FINANCE_CPM_USD = 10.00; // Example: $10 per 1000 views

// Target userbase options (should match frontend)
const TARGET_USERBASE_OPTIONS = {
  '1000': { label: '1,000 - 10,000 users (Small audience)', multiplier: 1 },
  '10000': { label: '10,000 - 50,000 users (Medium audience)', multiplier: 1.3 },
  '50000': { label: '50,000 - 200,000 users (Large audience)', multiplier: 1.8 },
  '200000': { label: '200,000 - 1M users (Very large audience)', multiplier: 2.5 },
  '1000000': { label: '1M+ users (Maximum reach)', multiplier: 3.2 }
};

// Fetch exchange rates from external API
const fetchExchangeRates = async () => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Failed to fetch exchange rates:', error);
    // Return fallback rates
    return {
      USD: 1,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 150,
      CAD: 1.36,
      AUD: 1.53,
      CHF: 0.88,
      CNY: 7.24,
      INR: 83.12,
      BRL: 5.02,
      ZAR: 18.75,
      KES: 128.5,
      NGN: 785.4,
      UGX: 3780
    };
  }
};

// Get user's currency based on country detection or preference
const getUserCurrency = (userCountry) => {
  const currencies = {
    "United States": { code: "USD", symbol: "$" },
    "United Kingdom": { code: "GBP", symbol: "£" },
    "Canada": { code: "CAD", symbol: "C$" },
    "Germany": { code: "EUR", symbol: "€" },
    "France": { code: "EUR", symbol: "€" },
    "Japan": { code: "JPY", symbol: "¥" },
    "Australia": { code: "AUD", symbol: "A$" },
    "Kenya": { code: "KES", symbol: "KES" },
    "Nigeria": { code: "NGN", symbol: "₦" },
    "South Africa": { code: "ZAR", symbol: "R" },
    "India": { code: "INR", symbol: "₹" },
    "Brazil": { code: "BRL", symbol: "R$" },
    "China": { code: "CNY", symbol: "¥" }
  };
  
  return currencies[userCountry] || currencies["United States"];
};

// @desc    Create a new ad
// @route   POST /api/ads
// @access  Private
const createAd = async (req, res) => {
  try {
    // Log the incoming request data for debugging
    console.log('Creating ad with data:', JSON.stringify(req.body, null, 2));
    console.log('req.user:', req.user);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      title,
      description,
      category,
      image,
      imagePublicId,
      video,
      videoPublicId,
      linkUrl,
      contactMethod = 'link',
      whatsappNumber,
      whatsappCountryCode,
      targetingType,
      targetCountries,
      duration,
      targetUserbase,
      userCountry = 'United States'
    } = req.body;


    // Validate that at least one media type is provided
    if (!image && !video) {
      return res.status(400).json({
        success: false,
        message: 'Ad must include either an image or video'
      });
    }

    // Validate targeting type and countries
    if (targetingType === 'specific' && (!targetCountries || targetCountries.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Target countries are required for specific targeting'
      });
    }

    // Validate target userbase
    const userbaseOption = TARGET_USERBASE_OPTIONS[targetUserbase];
    if (!userbaseOption) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target userbase size'
      });
    }

    // WhatsApp number/country code validation and normalization
    let finalWhatsappNumber = whatsappNumber;
    let finalWhatsappCountryCode = whatsappCountryCode;
    if (contactMethod === 'whatsapp') {
      // If country code not provided, try to infer from userCountry
      if (!finalWhatsappCountryCode && userCountry) {
        // Example mapping, expand as needed
        const countryCodeMap = {
          'United States': '+1',
          'United Kingdom': '+44',
          'Kenya': '+254',
          'Nigeria': '+234',
          'India': '+91',
          'South Africa': '+27',
          'Canada': '+1',
          'Germany': '+49',
          'France': '+33',
          'Japan': '+81',
          'Brazil': '+55',
          'China': '+86',
          // ...add more as needed
        };
        finalWhatsappCountryCode = countryCodeMap[userCountry] || '+1';
      }
      // If number does not start with +, prepend country code
      if (finalWhatsappNumber && !/^\+/.test(finalWhatsappNumber)) {
        // Remove leading zeros and spaces/dashes
        let clean = String(finalWhatsappNumber).replace(/^[0]+/, '').replace(/[^\d]/g, '');
        finalWhatsappNumber = `${finalWhatsappCountryCode}${clean}`;
      }
      // Ensure E.164 format
      if (!/^\+[1-9]\d{7,14}$/.test(finalWhatsappNumber)) {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp number must be in international E.164 format (e.g. +1234567890)'
        });
      }
    }

    // Fetch current exchange rates
    const exchangeRates = await fetchExchangeRates();
    const userCurrency = getUserCurrency(userCountry);

    // Create new ad instance
    const newAd = new Ad({
      title,
      description,
      category,
      image,
      imagePublicId,
      video,
      videoPublicId,
      linkUrl,
      contactMethod,
      whatsappNumber: finalWhatsappNumber,
      whatsappCountryCode: finalWhatsappCountryCode,
      targetingType,
      targetCountries: targetingType === 'specific' ? targetCountries : [],
      duration,
      targetUserbase: {
        size: targetUserbase,
        label: userbaseOption.label,
        multiplier: userbaseOption.multiplier
      },
      // Set schedule to start immediately and end after selected duration
      schedule: {
        startDate: new Date(), // Start immediately
        endDate: new Date(Date.now() + (duration * 24 * 60 * 60 * 1000)), // Add duration days in milliseconds
        timeZone: 'UTC'
      },
      // Auto-approve ads (no admin approval needed for now)
      status: 'active',
      isApproved: true,
      approvedAt: new Date(),
      userId: req.user.id
    });

    console.log('📅 Ad schedule set:', {
      startDate: newAd.schedule.startDate,
      endDate: newAd.schedule.endDate,
      duration: duration + ' days',
      status: 'active',
      isApproved: true
    });

    // Calculate pricing
    const totalPriceUSD = newAd.calculateTotalPrice(FINANCE_CPM_USD, exchangeRates);
    
    // Convert to user's currency
    newAd.convertToUserCurrency(exchangeRates, userCurrency.code, userCurrency.symbol);

    // Save the ad
    const savedAd = await newAd.save();

    // Populate user information for response (username, verified status, profile)
    await savedAd.populate({
      path: "userId",
      select: "username verified profile.profileImage countryFlag"
    });

    res.status(201).json({
      success: true,
      message: 'Ad created successfully and is now LIVE! 🚀',
      data: {
        ad: savedAd,
        status: 'active',
        isApproved: true,
        schedule: {
          startDate: savedAd.schedule.startDate,
          endDate: savedAd.schedule.endDate,
          durationDays: duration
        },
        pricing: {
          totalUSD: totalPriceUSD,
          totalUserCurrency: savedAd.pricing.userCurrency.convertedPrice,
          currency: userCurrency,
          breakdown: savedAd.pricing.priceBreakdown
        }
      }
    });

  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating ad',
      error: error.message
    });
  }
};

// @desc    Get all ads for the authenticated user
// @route   GET /api/ads
// @access  Private
const getUserAds = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const category = req.query.category;

    const query = { userId: req.user.id };
    
    if (status) query.status = status;
    if (category) query.category = category;

    const ads = await Ad.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'username verified profile.profileImage countryFlag');

    const total = await Ad.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        ads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ads',
      error: error.message
    });
  }
};

// @desc    Get single ad by ID
// @route   GET /api/ads/:id
// @access  Private
const getAdById = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id).populate('userId', 'username verified profile.profileImage countryFlag');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user owns the ad or is admin
    if (ad.userId._id.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this ad'
      });
    }

    res.status(200).json({
      success: true,
      data: { ad }
    });

  } catch (error) {
    console.error('Error fetching ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ad',
      error: error.message
    });
  }
};

// @desc    Update ad
// @route   PUT /api/ads/:id
// @access  Private
const updateAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user owns the ad
    if (ad.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this ad'
      });
    }

    // Only allow updates if ad is in draft status
    if (ad.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only update ads in draft status'
      });
    }

    const allowedUpdates = ['title', 'description', 'category', 'targetingType', 'targetCountries', 'duration', 'targetUserbase'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // Recalculate pricing if relevant fields are updated
    if (updates.targetingType || updates.targetCountries || updates.duration || updates.targetUserbase) {
      const exchangeRates = await fetchExchangeRates();
      const userCurrency = getUserCurrency(req.body.userCountry || 'United States');
      
      Object.assign(ad, updates);
      
      if (updates.targetUserbase) {
        const userbaseOption = TARGET_USERBASE_OPTIONS[updates.targetUserbase];
        ad.targetUserbase = {
          size: updates.targetUserbase,
          label: userbaseOption.label,
          multiplier: userbaseOption.multiplier
        };
      }
      
      ad.calculateTotalPrice(BASE_TIER_PRICING_USD, exchangeRates);
      ad.calculateTotalPrice(FINANCE_CPM_USD, exchangeRates);
      ad.convertToUserCurrency(exchangeRates, userCurrency.code, userCurrency.symbol);
    } else {
      Object.assign(ad, updates);
    }

    const updatedAd = await ad.save();

    res.status(200).json({
      success: true,
      message: 'Ad updated successfully',
      data: { ad: updatedAd }
    });

  } catch (error) {
    console.error('Error updating ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ad',
      error: error.message
    });
  }
};

// @desc    Delete ad
// @route   DELETE /api/ads/:id
// @access  Private
const deleteAd = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user owns the ad
    if (ad.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this ad'
      });
    }

    // Only allow deletion if ad is in draft status or hasn't started
    if (!['draft', 'pending_payment'].includes(ad.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete active or completed ads'
      });
    }

    // Delete media from Cloudinary if present
    try {
      if (ad.imagePublicId) {
        await cloudinary.uploader.destroy(ad.imagePublicId, { resource_type: "image" });
        console.log(`Deleted image from Cloudinary: ${ad.imagePublicId}`);
      }
      if (ad.videoPublicId) {
        await cloudinary.uploader.destroy(ad.videoPublicId, { resource_type: "video" });
        console.log(`Deleted video from Cloudinary: ${ad.videoPublicId}`);
      }
    } catch (cloudinaryError) {
      console.error('Error deleting media from Cloudinary:', cloudinaryError);
      // Continue with ad deletion even if media cleanup fails
    }

    await Ad.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Ad deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting ad',
      error: error.message
    });
  }
};

// @desc    Calculate ad pricing
// @route   POST /api/ads/calculate-pricing
// @access  Private
const calculatePricing = async (req, res) => {
  try {
    const {
      targetingType,
      targetCountries,
      duration,
      targetUserbase,
      userCountry = 'United States'
    } = req.body;

    // Validate inputs
    if (!targetingType || !duration || !targetUserbase) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields for pricing calculation'
      });
    }

    if (targetingType === 'specific' && (!targetCountries || targetCountries.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Target countries are required for specific targeting'
      });
    }

    const userbaseOption = TARGET_USERBASE_OPTIONS[targetUserbase];
    if (!userbaseOption) {
      return res.status(400).json({
        success: false,
        message: 'Invalid target userbase size'
      });
    }

    // Calculate base price
    let basePrice = 0;
    if (targetingType === 'global') {
      basePrice = BASE_TIER_PRICING_USD.global;
    } else {
      basePrice = targetCountries.reduce((sum, country) => {
        return sum + BASE_TIER_PRICING_USD[country.tier];
      }, 0);
    }

    const totalPriceUSD = basePrice * duration * userbaseOption.multiplier;

    // Get exchange rates and convert to user currency
    const exchangeRates = await fetchExchangeRates();
    const userCurrency = getUserCurrency(userCountry);
    const rate = exchangeRates[userCurrency.code] || 1;
    const convertedPrice = totalPriceUSD * rate;

    res.status(200).json({
      success: true,
      data: {
        pricing: {
          basePrice,
          totalPriceUSD,
          convertedPrice,
          currency: userCurrency,
          breakdown: {
            basePrice,
            durationMultiplier: duration,
            audienceMultiplier: userbaseOption.multiplier,
            countryCount: targetingType === 'global' ? 1 : targetCountries.length
          },
          exchangeRate: rate
        }
      }
    });

  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing',
      error: error.message
    });
  }
};

// @desc    Submit ad for approval
// @route   POST /api/ads/:id/submit
// @access  Private
const submitAdForApproval = async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    // Check if user owns the ad
    if (ad.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this ad'
      });
    }

    // Only allow submission if ad is in draft status
    if (ad.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Can only submit ads in draft status'
      });
    }

    ad.status = 'pending_payment';
    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Ad submitted for approval successfully',
      data: { ad }
    });

  } catch (error) {
    console.error('Error submitting ad:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting ad',
      error: error.message
    });
  }
};

// @desc    Get exchange rates
// @route   GET /api/ads/exchange-rates
// @access  Public
const getExchangeRates = async (req, res) => {
  try {
    const rates = await fetchExchangeRates();
    
    res.status(200).json({
      success: true,
      data: { rates }
    });

  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching exchange rates',
      error: error.message
    });
  }
};

// Get all active ads (public endpoint)
const getActiveAds = async (req, res) => {
  try {
    const currentDate = new Date();
    
    // Find ads that are active and within their schedule period
    const activeAds = await Ad.find({
      status: 'active',
      isApproved: true,
      'schedule.startDate': { $lte: currentDate },
      'schedule.endDate': { $gte: currentDate }
    })
    .populate('userId', 'username verified profile.profileImage profile.verified countryFlag')
    .select('title description linkUrl buttonText image video category targetingType schedule createdAt userId')
    .sort({ createdAt: -1 })
    .limit(20); // Limit to 20 ads for performance

    console.log(`📢 Found ${activeAds.length} active ads`);

    res.json({
      success: true,
      ads: activeAds
    });
  } catch (error) {
    console.error('Error fetching active ads:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active ads',
      error: error.message
    });
  }
};

module.exports = {
  createAd,
  getUserAds,
  getAdById,
  updateAd,
  deleteAd,
  calculatePricing,
  submitAdForApproval,
  getExchangeRates,
  getActiveAds
};
