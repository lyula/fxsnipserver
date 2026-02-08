const mongoose = require('mongoose');

const TradeJournalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'TradingAccount', required: true },
  
  // Trade details from MetaAPI
  positionId: { type: String }, // MetaAPI position ID
  ticket: { type: String }, // MT4/MT5 ticket number
  
  // Basic trade info
  type: { type: String, enum: ['Buy', 'Sell'], required: true },
  pair: { type: String, required: true }, // e.g., EURUSD, GBPJPY
  
  // Price and volume
  openPrice: { type: Number, required: true },
  closePrice: { type: Number },
  volume: { type: Number, required: true }, // Lot size
  
  // Timing
  openTime: { type: Date, required: true },
  closeTime: { type: Date },
  duration: { type: Number }, // Duration in minutes
  
  // Trade results
  profit: { type: Number, default: 0 },
  pips: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
  swap: { type: Number, default: 0 },
  
  // Status
  status: { 
    type: String, 
    enum: ['open', 'closed', 'pending'],
    default: 'open'
  },
  outcome: { 
    type: String, 
    enum: ['profit', 'loss', 'breakeven', 'pending'],
    default: 'pending'
  },
  
  // User-added data for discipline tracking
  userNotes: {
    // Pre-trade analysis
    strategy: { type: String }, // User's strategy name
    confluences: [{ type: String }], // Array of confluences used
    emotions: { type: String }, // Emotional state before trade
    confidence: { type: Number, min: 1, max: 10 }, // Confidence level
    
    // Screenshots/recordings
    beforeScreenshot: {
      url: String,
      publicId: String
    },
    afterScreenshot: {
      url: String,
      publicId: String
    },
    beforeScreenRecording: {
      url: String,
      publicId: String
    },
    afterScreenRecording: {
      url: String,
      publicId: String
    },
    
    // Post-trade reflection
    postTradeNotes: { type: String },
    lessonsLearned: { type: String },
    mistakes: [{ type: String }],
    didFollowPlan: { type: Boolean },
  },
  
  // Session tracking
  session: { 
    type: String, 
    enum: ['London', 'New York', 'Tokyo', 'Sydney', 'Asian', 'European', 'American'],
  },
  
  // Advanced metrics
  riskRewardRatio: { type: Number },
  stopLoss: { type: Number },
  takeProfit: { type: Number },
  
  // Sync status
  syncedFromMetaAPI: { type: Boolean, default: false },
  syncedFromEA: { type: Boolean, default: false },
  lastSyncedAt: { type: Date },
  
}, { timestamps: true });

// Indexes for performance
TradeJournalSchema.index({ userId: 1, openTime: -1 });
TradeJournalSchema.index({ accountId: 1, status: 1 });
TradeJournalSchema.index({ userId: 1, pair: 1 });
TradeJournalSchema.index({ positionId: 1 });
TradeJournalSchema.index({ accountId: 1, ticket: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('TradeJournal', TradeJournalSchema);
