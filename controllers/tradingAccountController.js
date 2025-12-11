const TradingAccount = require('../models/TradingAccount');
const metaApiService = require('../services/metaApiService');

/**
 * Connect a new trading account
 */
exports.connectAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountName, login, password, server, platform, broker } = req.body;

    // Validation
    if (!accountName || !login || !password || !server || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: accountName, login, password, server, platform',
      });
    }

    if (!['mt4', 'mt5'].includes(platform.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be either mt4 or mt5',
      });
    }

    // Connect account via MetaAPI
    const result = await metaApiService.connectAccount(userId, {
      accountName,
      login,
      password,
      server,
      platform: platform.toLowerCase(),
      broker,
    });

    res.status(201).json({
      success: true,
      message: 'Account connected successfully',
      account: result.account,
    });
  } catch (error) {
    console.error('Connect account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect account',
    });
  }
};

/**
 * Get all user's trading accounts
 */
exports.getAccounts = async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await TradingAccount.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accounts',
    });
  }
};

/**
 * Get account details
 */
exports.getAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    res.status(200).json({
      success: true,
      account,
    });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account',
    });
  }
};

/**
 * Sync account data from MetaAPI
 */
exports.syncAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    // Verify ownership
    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    // Sync account
    const result = await metaApiService.syncAccount(accountId);

    res.status(200).json({
      success: true,
      message: 'Account synced successfully',
      account: result.account,
      stats: result.stats,
    });
  } catch (error) {
    console.error('Sync account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sync account',
    });
  }
};

/**
 * Get account statistics
 */
exports.getAccountStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    res.status(200).json({
      success: true,
      stats: account.stats,
      lastSyncedAt: account.lastSyncedAt,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch account stats',
    });
  }
};

/**
 * Set primary account
 */
exports.setPrimaryAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    // Verify ownership
    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    // Unset all primary accounts
    await TradingAccount.updateMany({ userId }, { isPrimary: false });

    // Set this account as primary
    account.isPrimary = true;
    await account.save();

    res.status(200).json({
      success: true,
      message: 'Primary account updated',
      account,
    });
  } catch (error) {
    console.error('Set primary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set primary account',
    });
  }
};

/**
 * Disconnect account
 */
exports.disconnectAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    // Verify ownership
    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    // Disconnect via MetaAPI
    await metaApiService.disconnectAccount(accountId);

    res.status(200).json({
      success: true,
      message: 'Account disconnected successfully',
    });
  } catch (error) {
    console.error('Disconnect account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect account',
    });
  }
};

/**
 * Delete account
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found',
      });
    }

    // Try to disconnect first if active (don't fail if this errors)
    if (account.connectionState !== 'UNDEPLOYED') {
      try {
        await metaApiService.disconnectAccount(accountId);
      } catch (disconnectError) {
        console.error('Warning: Failed to disconnect account during deletion:', disconnectError.message);
        // Continue with deletion even if disconnect fails
      }
    }

    // Delete all associated trades from TradeJournal
    const TradeJournal = require('../models/TradeJournal');
    await TradeJournal.deleteMany({ accountId });

    // Remove from user preferences if set as primary
    const UserPreferences = require('../models/UserPreferences');
    await UserPreferences.updateMany(
      { 'dashboardSettings.primaryAccountId': accountId },
      { $unset: { 'dashboardSettings.primaryAccountId': '' } }
    );

    // Delete the account
    await TradingAccount.findByIdAndDelete(accountId);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message,
    });
  }
};

/**
 * Get dashboard summary (all accounts aggregated)
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    const accounts = await TradingAccount.find({ userId, isActive: true });

    if (accounts.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          totalBalance: 0,
          totalEquity: 0,
          totalProfit: 0,
          winRate: 0,
          monthlyROI: 0,
        },
        accounts: [],
      });
    }

    // Aggregate stats across all accounts
    const summary = accounts.reduce(
      (acc, account) => {
        const stats = account.stats || {};
        return {
          totalBalance: acc.totalBalance + (stats.balance || 0),
          totalEquity: acc.totalEquity + (stats.equity || 0),
          totalProfit: acc.totalProfit + (stats.profit || 0),
          totalTrades: acc.totalTrades + (stats.totalTrades || 0),
          winningTrades: acc.winningTrades + (stats.winningTrades || 0),
          monthProfit: acc.monthProfit + (stats.monthProfit || 0),
        };
      },
      {
        totalBalance: 0,
        totalEquity: 0,
        totalProfit: 0,
        totalTrades: 0,
        winningTrades: 0,
        monthProfit: 0,
      }
    );

    // Calculate aggregated win rate and ROI
    summary.winRate = summary.totalTrades > 0 
      ? (summary.winningTrades / summary.totalTrades) * 100 
      : 0;

    summary.monthlyROI = summary.totalBalance > 0 
      ? (summary.monthProfit / summary.totalBalance) * 100 
      : 0;

    res.status(200).json({
      success: true,
      summary,
      accounts: accounts.map(acc => ({
        id: acc._id,
        accountName: acc.accountName,
        platform: acc.platform,
        stats: acc.stats,
        isPrimary: acc.isPrimary,
      })),
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
    });
  }
};
