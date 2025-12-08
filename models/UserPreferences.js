const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Trading preferences
  tradingPreferences: {
    // Pairs the user trades
    preferredPairs: [{ type: String }], // e.g., ['EURUSD', 'GBPJPY', 'USDJPY']
    
    // Confluences the user tracks
    confluences: [{ 
      name: { type: String },
      description: { type: String },
      category: { type: String, enum: ['technical', 'fundamental', 'sentiment', 'other'] },
      createdAt: { type: Date, default: Date.now }
    }],
    
    // Trading strategies
    strategies: [{
      name: { type: String },
      description: { type: String },
      rules: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    
    // Sessions they trade
    preferredSessions: [{
      type: String,
      enum: ['London', 'New York', 'Tokyo', 'Sydney', 'Asian', 'European', 'American']
    }],
    
    // Risk management
    maxRiskPerTrade: { type: Number, default: 2 }, // Percentage
    maxDailyDrawdown: { type: Number, default: 5 }, // Percentage
    defaultLotSize: { type: Number, default: 0.01 },
  },
  
  // Dashboard preferences
  dashboardSettings: {
    defaultTimeframe: { 
      type: String, 
      enum: ['today', 'week', 'month', 'quarter', '6months', 'year'],
      default: 'month'
    },
    primaryAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAccount' },
    showClosedTrades: { type: Boolean, default: true },
    showPendingOrders: { type: Boolean, default: true },
  },
  
  // Notification preferences
  notifications: {
    tradeOpened: { type: Boolean, default: true },
    tradeClosed: { type: Boolean, default: true },
    profitTarget: { type: Boolean, default: true },
    stopLossHit: { type: Boolean, default: true },
    dailyDrawdownAlert: { type: Boolean, default: true },
  },
  
}, { timestamps: true });

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);
