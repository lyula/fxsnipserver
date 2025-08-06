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
  
  // Media Content (uploaded to Cloudinary)
  image: {
    type: String,
    validate: [
      {
        validator: function(v) {
          if (!v) return true; // Optional
          return /^https:\/\/res\.cloudinary\.com\//.test(v);
        },
        message: 'Image must be a valid Cloudinary URL'
      },
      {
        validator: function(v) {
          // At least one media type must be provided
          return !!(v || this.video);
        },
        message: 'Ad must include either an image or video'
      }
    ]
  },
  
  imagePublicId: {
    type: String,
    validate: {
      validator: function(v) {
        // If image exists, imagePublicId should also exist
        if (this.image && !v) return false;
        return true;
      },
      message: 'Image public ID is required when image is provided'
    }
  },
  
  video: {
    type: String,
    validate: [
      {
        validator: function(v) {
          if (!v) return true; // Optional
          return /^https:\/\/res\.cloudinary\.com\//.test(v);
        },
        message: 'Video must be a valid Cloudinary URL'
      },
      {
        validator: function(v) {
          // At least one media type must be provided
          return !!(v || this.image);
        },
        message: 'Ad must include either an image or video'
      }
    ]
  },
  
  videoPublicId: {
    type: String,
    validate: {
      validator: function(v) {
        // If video exists, videoPublicId should also exist
        if (this.video && !v) return false;
        return true;
      },
      message: 'Video public ID is required when video is provided'
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
  let basePrice = 0;
  
  if (this.targetingType === 'global') {
    basePrice = basePricing.global;
  } else {
    basePrice = this.targetCountries.reduce((sum, country) => {
      return sum + basePricing[country.tier];
    }, 0);
  }
  
  const totalPriceUSD = basePrice * this.duration * this.targetUserbase.multiplier;
  
  this.pricing = {
    basePriceUSD: basePrice,
    totalPriceUSD: totalPriceUSD,
    priceBreakdown: {
      basePrice: basePrice,
      durationMultiplier: this.duration,
      audienceMultiplier: this.targetUserbase.multiplier,
      countryCount: this.targetingType === 'global' ? 1 : this.targetCountries.length
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
