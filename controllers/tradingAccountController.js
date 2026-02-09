const TradingAccount = require('../models/TradingAccount');
const EAApiKey = require('../models/EAApiKey');
const metaApiService = require('../services/metaApiService');
const { generateKey, hashKey, getKeyPrefix } = EAApiKey;

/**
 * Connect a new EA-linked trading account (no MetaAPI, no password).
 * Creates account with source: 'ea'. User then gets an API key for this account.
 */
exports.connectEAAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountName, login, server, platform, broker } = req.body;

    if (!accountName || !login || !server || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: accountName, login, server, platform',
      });
    }
    const platformNorm = platform.toLowerCase();
    if (!['mt4', 'mt5'].includes(platformNorm)) {
      return res.status(400).json({
        success: false,
        message: 'Platform must be mt4 or mt5',
      });
    }

    const existing = await TradingAccount.findOne({
      userId,
      source: 'ea',
      login: String(login),
      server: String(server),
      platform: platformNorm,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An EA account with this login, server and platform already exists',
      });
    }

    const account = await TradingAccount.create({
      userId,
      accountName: accountName.trim(),
      platform: platformNorm,
      login: String(login),
      server: String(server),
      broker: broker ? String(broker).trim() : undefined,
      source: 'ea',
      connectionState: 'DISCONNECTED',
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'EA account created. Get the API key for this account to use in your EA.',
      account,
    });
  } catch (error) {
    console.error('Connect EA account error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create EA account',
    });
  }
};

/**
 * Connect a new trading account (MetaAPI)
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
 * Get EA API key for an EA-linked account. If none exists, create one and return plain key once.
 * Only for accounts with source === 'ea'.
 */
exports.getEAApiKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    if (account.source !== 'ea') {
      return res.status(400).json({
        success: false,
        message: 'EA API key is only available for EA-linked accounts',
      });
    }

    let keyDoc = await EAApiKey.findOne({ accountId });
    if (!keyDoc) {
      const plainKey = generateKey();
      keyDoc = await EAApiKey.create({
        userId,
        accountId: account._id,
        keyHash: hashKey(plainKey),
        keyPrefix: getKeyPrefix(plainKey),
      });
      return res.status(200).json({
        success: true,
        apiKey: plainKey,
        key: {
          id: keyDoc._id,
          keyPrefix: keyDoc.keyPrefix,
          lastUsedAt: keyDoc.lastUsedAt || null,
          createdAt: keyDoc.createdAt,
        },
      });
    }

    res.status(200).json({
      success: true,
      key: {
        id: keyDoc._id,
        keyPrefix: keyDoc.keyPrefix,
        lastUsedAt: keyDoc.lastUsedAt || null,
        createdAt: keyDoc.createdAt,
      },
    });
  } catch (error) {
    console.error('Get EA API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get EA API key',
    });
  }
};

/**
 * Regenerate EA API key for an EA-linked account. Returns new plain key once.
 */
exports.regenerateEAApiKey = async (req, res) => {
  try {
    const userId = req.user._id;
    const { accountId } = req.params;

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    if (account.source !== 'ea') {
      return res.status(400).json({
        success: false,
        message: 'EA API key is only available for EA-linked accounts',
      });
    }

    await EAApiKey.deleteOne({ accountId });
    const plainKey = generateKey();
    const keyDoc = await EAApiKey.create({
      userId,
      accountId: account._id,
      keyHash: hashKey(plainKey),
      keyPrefix: getKeyPrefix(plainKey),
    });

    res.status(200).json({
      success: true,
      apiKey: plainKey,
      key: {
        id: keyDoc._id,
        keyPrefix: keyDoc.keyPrefix,
        lastUsedAt: null,
        createdAt: keyDoc.createdAt,
      },
    });
  } catch (error) {
    console.error('Regenerate EA API key error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate EA API key',
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
    if (account.source === 'ea') {
      return res.status(400).json({
        success: false,
        message: 'Sync is not available for EA-linked accounts; trades are pushed by the EA.',
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

    // Disconnect via MetaAPI (only for MetaAPI-linked accounts)
    if (account.source !== 'ea') {
      await metaApiService.disconnectAccount(accountId);
    }

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

    // Try to disconnect from MetaAPI first (only for MetaAPI-linked accounts)
    if (account.source !== 'ea' && account.connectionState !== 'UNDEPLOYED') {
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

    // Delete EA API key if this is an EA-linked account
    if (account.source === 'ea') {
      const EAApiKey = require('../models/EAApiKey');
      await EAApiKey.deleteOne({ accountId });
    }

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
