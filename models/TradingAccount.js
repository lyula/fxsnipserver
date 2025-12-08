const mongoose = require('mongoose');

const TradingAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountName: { type: String, required: true }, // User-friendly name
  metaApiAccountId: { type: String, required: true, unique: true }, // MetaAPI account ID
  platform: { type: String, enum: ['mt4', 'mt5'], required: true },
  broker: { type: String },
  login: { type: String }, // Trading account login
  server: { type: String }, // Broker server
  
  // Connection status
  connectionState: { 
    type: String, 
    enum: ['CONNECTED', 'DISCONNECTED', 'DEPLOYING', 'DEPLOYED', 'UNDEPLOYED', 'FAILED'],
    default: 'DISCONNECTED'
  },
  lastSyncedAt: { type: Date },
  
  // Account stats (cached for performance)
  stats: {
    balance: { type: Number, default: 0 },
    equity: { type: Number, default: 0 },
    margin: { type: Number, default: 0 },
    freeMargin: { type: Number, default: 0 },
    marginLevel: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    leverage: { type: Number },
    
    // Performance metrics
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 }, // Percentage
    totalProfit: { type: Number, default: 0 },
    totalLoss: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    
    // Monthly ROI
    monthlyROI: { type: Number, default: 0 },
    
    // Time period stats
    todayProfit: { type: Number, default: 0 },
    weekProfit: { type: Number, default: 0 },
    monthProfit: { type: Number, default: 0 },
    quarterProfit: { type: Number, default: 0 },
    sixMonthsProfit: { type: Number, default: 0 },
    yearProfit: { type: Number, default: 0 },
  },
  
  // User preferences
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false }, // Primary account for dashboard
  
}, { timestamps: true });

// Index for faster queries
TradingAccountSchema.index({ userId: 1, isActive: 1 });
TradingAccountSchema.index({ metaApiAccountId: 1 });

module.exports = mongoose.model('TradingAccount', TradingAccountSchema);
