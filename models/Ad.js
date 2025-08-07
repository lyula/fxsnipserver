const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  // Basic Ad Information
  title: {
    type: String,
    required: [true, 'Ad title is required'],
    trim: true,
    maxLength: [100, 'Title cannot exceed 100 characters'],
    minLength: [5, 'Title must be at least 5 characters']
  },
  
  description: {
    type: String,
    required: [true, 'Ad description is required'],
    trim: true,
    maxLength: [500, 'Description cannot exceed 500 characters'],
    minLength: [10, 'Description must be at least 10 characters']
  },
  
  // Media Content (uploaded to Cloudinary) - Support multiple images/videos
  image: {
    type: mongoose.Schema.Types.Mixed, // Can be string or array
    validate: [
      {
        validator: function(v) {
          if (!v) return true; // Optional
          if (typeof v === 'string') {
            return /^https?:\/\//.test(v);
          }
          if (Array.isArray(v)) {
            if (v.length > 5) return false; // Max 5 images
            return v.every(url => typeof url === 'string' && /^https?:\/\//.test(url));
          }
          return false;
        },
        message: 'Image must be a valid URL or array of URLs (max 5)'
      },
      {
        validator: function(v) {
          // At least one media type must be provided
          return !!(v || this.video);
        },
        message: 'Ad must include either images or videos'
      }
    ]
  },
  
  imagePublicId: {
    type: mongoose.Schema.Types.Mixed, // Can be string or array
    validate: {
      validator: function(v) {
        // If image exists, imagePublicId should also exist
        if (this.image && !v) return false;
        if (Array.isArray(this.image) && (!Array.isArray(v) || this.image.length !== v.length)) return false;
        return true;
      },
      message: 'Image public ID(s) required when image(s) provided'
    }
  },
  
  video: {
    type: mongoose.Schema.Types.Mixed, // Can be string or array
    validate: [
      {
        validator: function(v) {
          if (!v) return true; // Optional
          if (typeof v === 'string') {
            return /^https?:\/\//.test(v);
          }
          if (Array.isArray(v)) {
            if (v.length > 3) return false; // Max 3 videos
            return v.every(url => typeof url === 'string' && /^https?:\/\//.test(url));
          }
          return false;
        },
        message: 'Video must be a valid URL or array of URLs (max 3)'
      },
      {
        validator: function(v) {
          // At least one media type must be provided
          return !!(v || this.image);
        },
        message: 'Ad must include either images or videos'
      }
    ]
  },
  
  videoPublicId: {
    type: mongoose.Schema.Types.Mixed, // Can be string or array
    validate: {
      validator: function(v) {
        // If video exists, videoPublicId should also exist
        if (this.video && !v) return false;
        if (Array.isArray(this.video) && (!Array.isArray(v) || this.video.length !== v.length)) return false;
        return true;
      },
      message: 'Video public ID(s) required when video(s) provided'
    }
  },
  
  // Destination URL for the ad (where users go when they click)
  linkUrl: {
    type: String,
    required: [true, 'Link URL is required'],
    validate: {
      validator: function(v) {
        return /^https?:\/\//.test(v);
      },
      message: 'Link URL must be a valid URL starting with http:// or https://'
    }
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Finance', 'Education', 'Technology', 'Health', 'Lifestyle', 'Trading', 'Forex', 'Crypto', 'Events', 'Jobs'],
      message: '{VALUE} is not a valid category'
    }
  },
  
  // Targeting Information
  targetingType: {
    type: String,
    required: [true, 'Targeting type is required'],
    enum: {
      values: ['global', 'specific'],
      message: 'Targeting type must be either global or specific'
    }
  },
  
  targetCountries: [{
    name: {
      type: String,
      required: function() {
        return this.targetingType === 'specific';
      }
    },
    code: String,
    tier: {
      type: Number,
      enum: [1, 2, 3],
      required: function() {
        return this.targetingType === 'specific';
      }
    }
  }],
  
  // Campaign Duration
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 day'],
    max: [365, 'Duration cannot exceed 365 days']
  },
  
  // Audience Targeting
  targetUserbase: {
    size: {
      type: String,
      required: [true, 'Target userbase size is required'],
      enum: {
        values: ['1000', '10000', '50000', '200000', '1000000'],
        message: 'Invalid target userbase size'
      }
    },
    label: String,
    multiplier: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    }
  },
  
  // Pricing Information
  pricing: {
    basePriceUSD: {
      type: Number,
      required: true,
      min: 0
    },
    totalPriceUSD: {
      type: Number,
      required: true,
      min: 0
    },
    userCurrency: {
      code: String,
      symbol: String,
      rate: Number,
      convertedPrice: Number
    },
    priceBreakdown: {
      basePrice: Number,
      durationMultiplier: Number,
      audienceMultiplier: Number,
      countryCount: Number
    }
  },
  
  // Campaign Status
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  // Campaign Performance (to be updated during campaign)
  performance: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    clickThroughRate: {
      type: Number,
      default: 0
    },
    reach: {
      type: Number,
      default: 0
    },
    engagement: {
      type: Number,
      default: 0
    }
  },
  
  // Campaign Schedule
  schedule: {
    startDate: Date,
    endDate: Date,
    timeZone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // User Information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Payment Information
  paymentInfo: {
    paymentId: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    transactionId: String,
    paidAt: Date
  },
  
  // Admin fields
  isApproved: {
    type: Boolean,
    default: false
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  approvedAt: Date,
  
  rejectionReason: String,
  
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Analytics and performance tracking
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    uniqueViews: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    uniqueClicks: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    lastImpressionAt: Date,
    lastClickAt: Date,
    conversionRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
adSchema.index({ userId: 1, status: 1 });
adSchema.index({ category: 1, status: 1 });
adSchema.index({ 'targetCountries.name': 1 });
adSchema.index({ createdAt: -1 });
adSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });
adSchema.index({ 'analytics.impressions': -1 }); // For sorting by performance
adSchema.index({ status: 1, isApproved: 1, 'schedule.startDate': 1, 'schedule.endDate': 1 }); // For active ad queries

// Virtual fields
adSchema.virtual('isActive').get(function() {
  return this.status === 'active' && 
         this.schedule.startDate <= new Date() && 
         this.schedule.endDate >= new Date();
});

adSchema.virtual('daysRemaining').get(function() {
  if (!this.schedule.endDate) return 0;
  const today = new Date();
  const endDate = new Date(this.schedule.endDate);
  const diffTime = endDate - today;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

adSchema.virtual('totalSpent').get(function() {
  const daysElapsed = this.duration - this.daysRemaining;
  return Math.max(0, (this.pricing.totalPriceUSD / this.duration) * daysElapsed);
});

// Virtual field for click-through rate (CTR)
adSchema.virtual('clickThroughRate').get(function() {
  if (!this.analytics || this.analytics.impressions === 0) return 0;
  return ((this.analytics.clicks || 0) / this.analytics.impressions * 100).toFixed(2);
});

// Virtual field for unique engagement rate
adSchema.virtual('uniqueEngagementRate').get(function() {
  if (!this.analytics || !this.analytics.uniqueViews || this.analytics.uniqueViews.length === 0) return 0;
  const uniqueClicks = this.analytics.uniqueClicks ? this.analytics.uniqueClicks.length : 0;
  return ((uniqueClicks / this.analytics.uniqueViews.length) * 100).toFixed(2);
});

// Pre-save middleware
adSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate end date based on start date and duration
  if (this.schedule.startDate && this.duration) {
    const endDate = new Date(this.schedule.startDate);
    endDate.setDate(endDate.getDate() + this.duration);
    this.schedule.endDate = endDate;
  }
  
  next();
});

// Instance methods
adSchema.methods.calculateTotalPrice = function(basePricing, exchangeRates) {
  // CPM-based pricing: CPM = cost per 1000 views
  // Estimate total views as audience size * duration (days)
  const cpm = typeof basePricing === 'number' ? basePricing : 10.00;
  const audienceSize = this.targetUserbase && this.targetUserbase.size ? Number(this.targetUserbase.size) : 1000;
  const expectedViews = audienceSize * this.duration;
  const totalPriceUSD = Math.ceil(expectedViews / 1000) * cpm;

  this.pricing = {
    basePriceUSD: cpm,
    totalPriceUSD: totalPriceUSD,
    priceBreakdown: {
      cpm,
      expectedViews,
      audienceSize,
      duration: this.duration
    }
  };

  return totalPriceUSD;
};

adSchema.methods.convertToUserCurrency = function(exchangeRates, currencyCode, currencySymbol) {
  if (!this.pricing.totalPriceUSD) return;
  
  const rate = exchangeRates[currencyCode] || 1;
  const convertedPrice = this.pricing.totalPriceUSD * rate;
  
  this.pricing.userCurrency = {
    code: currencyCode,
    symbol: currencySymbol,
    rate: rate,
    convertedPrice: convertedPrice
  };
  
  return convertedPrice;
};

adSchema.methods.approve = function(adminUserId) {
  this.isApproved = true;
  this.approvedBy = adminUserId;
  this.approvedAt = new Date();
  this.status = 'pending_payment';
};

adSchema.methods.reject = function(reason) {
  this.isApproved = false;
  this.rejectionReason = reason;
  this.status = 'cancelled';
};

adSchema.methods.activate = function() {
  if (this.paymentInfo.paymentStatus === 'completed' && this.isApproved) {
    this.status = 'active';
    if (!this.schedule.startDate) {
      this.schedule.startDate = new Date();
    }
  }
};

module.exports = mongoose.model('Ad', adSchema);
