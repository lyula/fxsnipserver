const TradeJournal = require('../models/TradeJournal');
const TradingAccount = require('../models/TradingAccount');

/**
 * Get all trades for a user with filters
 * NOTE: Fetches from DATABASE only - no MetaAPI calls
 * Trades are synced to DB via POST /api/trading-accounts/:accountId/sync
 */
exports.getTrades = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId, status, timeframe, pair, session } = req.query;

    // Build filter
    const filter = { userId };

    if (accountId) {
      filter.accountId = accountId;
    }

    if (status) {
      filter.status = status; // 'open', 'closed', 'pending'
    }

    if (pair) {
      filter.pair = pair;
    }

    if (session) {
      filter.session = session;
    }

    // Time-based filters
    if (timeframe) {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'sixMonths':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        filter.openTime = { $gte: startDate };
      }
    }

    const trades = await TradeJournal.find(filter)
      .populate('accountId', 'accountName platform')
      .sort({ openTime: -1 });

    res.status(200).json({
      success: true,
      count: trades.length,
      trades,
    });
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trades',
    });
  }
};

/**
 * Get single trade details
 */
exports.getTrade = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tradeId } = req.params;

    const trade = await TradeJournal.findOne({ _id: tradeId, userId })
      .populate('accountId', 'accountName platform broker');

    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found',
      });
    }

    res.status(200).json({
      success: true,
      trade,
    });
  } catch (error) {
    console.error('Get trade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trade',
    });
  }
};

/**
 * Update trade notes (add confluences, emotions, strategy, etc.)
 */
exports.updateTradeNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tradeId } = req.params;
    const {
      strategy,
      confluences,
      emotions,
      confidence,
      screenshots,
      postTradeNotes,
      lessonsLearned,
      mistakes,
      didFollowPlan,
    } = req.body;

    const trade = await TradeJournal.findOne({ _id: tradeId, userId });
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found',
      });
    }

    // Update user notes
    if (strategy !== undefined) trade.userNotes.strategy = strategy;
    if (confluences !== undefined) trade.userNotes.confluences = confluences;
    if (emotions !== undefined) trade.userNotes.emotions = emotions;
    if (confidence !== undefined) trade.userNotes.confidence = confidence;
    if (screenshots !== undefined) trade.userNotes.screenshots = screenshots;
    if (postTradeNotes !== undefined) trade.userNotes.postTradeNotes = postTradeNotes;
    if (lessonsLearned !== undefined) trade.userNotes.lessonsLearned = lessonsLearned;
    if (mistakes !== undefined) trade.userNotes.mistakes = mistakes;
    if (didFollowPlan !== undefined) trade.userNotes.didFollowPlan = didFollowPlan;

    await trade.save();

    res.status(200).json({
      success: true,
      message: 'Trade notes updated successfully',
      trade,
    });
  } catch (error) {
    console.error('Update trade notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trade notes',
    });
  }
};

/**
 * Add screenshots to trade
 */
exports.addScreenshots = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tradeId } = req.params;
    const { screenshots } = req.body; // Array of Cloudinary URLs

    if (!Array.isArray(screenshots)) {
      return res.status(400).json({
        success: false,
        message: 'Screenshots must be an array of URLs',
      });
    }

    const trade = await TradeJournal.findOne({ _id: tradeId, userId });
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found',
      });
    }

    // Append new screenshots
    trade.userNotes.screenshots = [
      ...(trade.userNotes.screenshots || []),
      ...screenshots,
    ];

    await trade.save();

    res.status(200).json({
      success: true,
      message: 'Screenshots added successfully',
      trade,
    });
  } catch (error) {
    console.error('Add screenshots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add screenshots',
    });
  }
};

/**
 * Get trade statistics
 * NOTE: Calculates from DATABASE only - no MetaAPI calls
 */
exports.getTradeStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId, timeframe } = req.query;

    const filter = { userId, status: 'closed' };

    if (accountId) {
      filter.accountId = accountId;
    }

    // Time filter
    if (timeframe) {
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'sixMonths':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }

      if (startDate) {
        filter.closeTime = { $gte: startDate };
      }
    }

    const trades = await TradeJournal.find(filter);

    // Calculate statistics
    const stats = {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      averageWin: 0,
      averageLoss: 0,
      winRate: 0,
      profitFactor: 0,
      averageRR: 0,
      totalPips: 0,
      bestTrade: null,
      worstTrade: null,
      pairStats: {},
      sessionStats: {},
    };

    let totalRR = 0;
    let rrCount = 0;

    trades.forEach(trade => {
      const profit = trade.profit || 0;
      const pips = trade.pips || 0;

      stats.totalPips += pips;

      if (profit > 0) {
        stats.winningTrades++;
        stats.totalProfit += profit;
      } else if (profit < 0) {
        stats.losingTrades++;
        stats.totalLoss += Math.abs(profit);
      }

      stats.netProfit += profit;

      // Track best and worst
      if (!stats.bestTrade || profit > stats.bestTrade.profit) {
        stats.bestTrade = { id: trade._id, pair: trade.pair, profit };
      }
      if (!stats.worstTrade || profit < stats.worstTrade.profit) {
        stats.worstTrade = { id: trade._id, pair: trade.pair, profit };
      }

      // Risk-reward ratio
      if (trade.riskRewardRatio) {
        totalRR += trade.riskRewardRatio;
        rrCount++;
      }

      // Pair stats
      if (!stats.pairStats[trade.pair]) {
        stats.pairStats[trade.pair] = { trades: 0, profit: 0 };
      }
      stats.pairStats[trade.pair].trades++;
      stats.pairStats[trade.pair].profit += profit;

      // Session stats
      if (trade.session) {
        if (!stats.sessionStats[trade.session]) {
          stats.sessionStats[trade.session] = { trades: 0, profit: 0 };
        }
        stats.sessionStats[trade.session].trades++;
        stats.sessionStats[trade.session].profit += profit;
      }
    });

    // Calculate averages
    stats.averageWin = stats.winningTrades > 0 
      ? stats.totalProfit / stats.winningTrades 
      : 0;

    stats.averageLoss = stats.losingTrades > 0 
      ? stats.totalLoss / stats.losingTrades 
      : 0;

    stats.winRate = stats.totalTrades > 0 
      ? (stats.winningTrades / stats.totalTrades) * 100 
      : 0;

    stats.profitFactor = stats.totalLoss > 0 
      ? stats.totalProfit / stats.totalLoss 
      : stats.totalProfit > 0 ? Infinity : 0;

    stats.averageRR = rrCount > 0 ? totalRR / rrCount : 0;

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get trade stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trade statistics',
    });
  }
};

/**
 * Manually create a trade journal entry (for manual journaling)
 */
exports.createManualTrade = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      accountId,
      type,
      pair,
      openPrice,
      closePrice,
      volume,
      openTime,
      closeTime,
      profit,
      pips,
      stopLoss,
      takeProfit,
      userNotes,
      session,
    } = req.body;

    // Validation
    if (!accountId || !type || !pair || !openPrice || !volume || !openTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: accountId, type, pair, openPrice, volume, openTime',
      });
    }

    // Verify account ownership
    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found',
      });
    }

    const trade = new TradeJournal({
      userId,
      accountId,
      type,
      pair,
      openPrice,
      closePrice,
      volume,
      openTime,
      closeTime,
      profit,
      pips,
      stopLoss,
      takeProfit,
      status: closeTime ? 'closed' : 'open',
      outcome: profit > 0 ? 'profit' : profit < 0 ? 'loss' : 'breakeven',
      userNotes: userNotes || {},
      session,
      syncedFromMetaAPI: false,
    });

    await trade.save();

    res.status(201).json({
      success: true,
      message: 'Trade created successfully',
      trade,
    });
  } catch (error) {
    console.error('Create manual trade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create trade',
    });
  }
};

/**
 * Delete trade
 */
exports.deleteTrade = async (req, res) => {
  try {
    const userId = req.user._id;
    const { tradeId } = req.params;

    const trade = await TradeJournal.findOne({ _id: tradeId, userId });
    if (!trade) {
      return res.status(404).json({
        success: false,
        message: 'Trade not found',
      });
    }

    // Only allow deletion of manually created trades
    if (trade.syncedFromMetaAPI) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete trades synced from MetaAPI',
      });
    }
    if (trade.syncedFromEA) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete trades synced from EA',
      });
    }

    await TradeJournal.findByIdAndDelete(tradeId);

    res.status(200).json({
      success: true,
      message: 'Trade deleted successfully',
    });
  } catch (error) {
    console.error('Delete trade error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trade',
    });
  }
};
