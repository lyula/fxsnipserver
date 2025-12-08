const MetaApi = require('metaapi.cloud-sdk').default;
const TradingAccount = require('../models/TradingAccount');
const TradeJournal = require('../models/TradeJournal');

class MetaAPIService {
  constructor() {
    this.token = process.env.METAAPI_TOKEN;
    if (!this.token) {
      throw new Error('METAAPI_TOKEN is not set in environment variables');
    }
    this.api = new MetaApi(this.token);
    this.connections = new Map(); // Cache connections
  }

  /**
   * Connect a new MT4/MT5 account
   */
  async connectAccount(userId, accountData) {
    try {
      const { accountName, login, password, server, platform, broker } = accountData;

      // Create account in MetaAPI
      const account = await this.api.metatraderAccountApi.createAccount({
        name: accountName,
        type: 'cloud',
        login: login,
        password: password,
        server: server,
        platform: platform, // 'mt4' or 'mt5'
        magic: 0,
      });

      // Deploy account
      await account.deploy();

      // Wait for deployment
      await account.waitDeployed();

      // Save to database
      const tradingAccount = new TradingAccount({
        userId,
        accountName,
        metaApiAccountId: account.id,
        platform,
        broker,
        login,
        server,
        connectionState: 'DEPLOYED',
      });

      await tradingAccount.save();

      return {
        success: true,
        account: tradingAccount,
        metaApiAccount: account,
      };
    } catch (error) {
      console.error('Error connecting account:', error);
      throw new Error(`Failed to connect account: ${error.message}`);
    }
  }

  /**
   * Get account connection
   */
  async getConnection(metaApiAccountId) {
    if (this.connections.has(metaApiAccountId)) {
      return this.connections.get(metaApiAccountId);
    }

    const account = await this.api.metatraderAccountApi.getAccount(metaApiAccountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    this.connections.set(metaApiAccountId, connection);
    return connection;
  }

  /**
   * Get account information (balance, equity, etc.)
   */
  async getAccountInfo(metaApiAccountId) {
    try {
      const connection = await this.getConnection(metaApiAccountId);
      const accountInfo = await connection.getAccountInformation();

      return {
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        margin: accountInfo.margin,
        freeMargin: accountInfo.freeMargin,
        marginLevel: accountInfo.marginLevel,
        currency: accountInfo.currency,
        leverage: accountInfo.leverage,
        profit: accountInfo.profit,
      };
    } catch (error) {
      console.error('Error getting account info:', error);
      throw error;
    }
  }

  /**
   * Get open positions
   */
  async getOpenPositions(metaApiAccountId) {
    try {
      const connection = await this.getConnection(metaApiAccountId);
      const positions = await connection.getPositions();

      return positions.map(pos => ({
        positionId: pos.id,
        type: pos.type === 'POSITION_TYPE_BUY' ? 'Buy' : 'Sell',
        symbol: pos.symbol,
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        profit: pos.profit,
        swap: pos.swap,
        commission: pos.commission,
        openTime: new Date(pos.time),
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
      }));
    } catch (error) {
      console.error('Error getting positions:', error);
      throw error;
    }
  }

  /**
   * Get trade history within a date range
   */
  async getTradeHistory(metaApiAccountId, startTime, endTime) {
    try {
      const connection = await this.getConnection(metaApiAccountId);
      const deals = await connection.getDeals(startTime, endTime);

      return deals.map(deal => ({
        ticket: deal.id,
        positionId: deal.positionId,
        type: deal.type === 'DEAL_TYPE_BUY' ? 'Buy' : 'Sell',
        symbol: deal.symbol,
        volume: deal.volume,
        price: deal.price,
        profit: deal.profit,
        commission: deal.commission,
        swap: deal.swap,
        time: new Date(deal.time),
        comment: deal.comment,
      }));
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  }

  /**
   * Calculate statistics from trade history
   */
  calculateStats(trades) {
    const stats = {
      totalTrades: trades.length,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      totalLoss: 0,
      netProfit: 0,
      winRate: 0,
    };

    trades.forEach(trade => {
      if (trade.profit > 0) {
        stats.winningTrades++;
        stats.totalProfit += trade.profit;
      } else if (trade.profit < 0) {
        stats.losingTrades++;
        stats.totalLoss += Math.abs(trade.profit);
      }
      stats.netProfit += trade.profit;
    });

    stats.winRate = stats.totalTrades > 0 
      ? (stats.winningTrades / stats.totalTrades) * 100 
      : 0;

    return stats;
  }

  /**
   * Sync account data and update database
   * Only fetches NEW trades from MetaAPI, existing trades are kept in DB
   */
  async syncAccount(accountId) {
    try {
      const account = await TradingAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      // Get account info (always fetch latest)
      const accountInfo = await this.getAccountInfo(account.metaApiAccountId);

      // Get open positions (always fetch latest)
      const positions = await this.getOpenPositions(account.metaApiAccountId);

      // Get trade history for different periods
      const now = new Date();
      const periods = {
        today: new Date(now.setHours(0, 0, 0, 0)),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getFullYear(), now.getMonth(), 1),
        quarter: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
        sixMonths: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        year: new Date(now.getFullYear(), 0, 1),
      };

      // Find the last synced trade to avoid fetching duplicates
      const lastSyncedTrade = await TradeJournal.findOne({
        accountId: account._id,
        syncedFromMetaAPI: true
      }).sort({ closeTime: -1 });

      const startTime = lastSyncedTrade?.closeTime || periods.year;

      const allTrades = await this.getTradeHistory(
        account.metaApiAccountId,
        startTime,
        new Date()
      );

      // Sync NEW trades to database first
      for (const trade of allTrades) {
        // Check if trade already exists
        const existingTrade = await TradeJournal.findOne({
          ticket: trade.ticket,
          accountId: account._id
        });

        if (!existingTrade) {
          // Only insert NEW trades
          await TradeJournal.create({
            userId: account.userId,
            accountId: account._id,
            ticket: trade.ticket,
            positionId: trade.positionId,
            type: trade.type,
            pair: trade.symbol,
            openPrice: trade.price,
            closePrice: trade.price,
            volume: trade.volume,
            closeTime: trade.time,
            profit: trade.profit,
            commission: trade.commission,
            swap: trade.swap,
            status: 'closed',
            outcome: trade.profit > 0 ? 'win' : trade.profit < 0 ? 'loss' : 'breakeven',
            syncedFromMetaAPI: true,
            lastSyncedAt: new Date(),
          });
        }
      }

      // Now calculate stats from DATABASE (not from MetaAPI response)
      const dbTrades = await TradeJournal.find({
        accountId: account._id,
        status: 'closed'
      });

      const stats = this.calculateStats(dbTrades);

      // Calculate period profits from DATABASE
      const periodStats = {};
      Object.keys(periods).forEach(period => {
        const periodTrades = dbTrades.filter(t => t.closeTime >= periods[period]);
        const periodProfit = periodTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
        periodStats[`${period}Profit`] = periodProfit;
      });

      // Calculate monthly ROI
      const monthStart = periods.month;
      const monthTrades = dbTrades.filter(t => t.closeTime >= monthStart);
      const monthProfit = monthTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const monthlyROI = accountInfo.balance > 0 
        ? (monthProfit / accountInfo.balance) * 100 
        : 0;

      // Update account stats
      account.stats = {
        ...accountInfo,
        ...stats,
        ...periodStats,
        monthlyROI,
      };
      account.connectionState = 'CONNECTED';
      account.lastSyncedAt = new Date();

      await account.save();

      // Sync open positions to TradeJournal
      for (const position of positions) {
        await TradeJournal.findOneAndUpdate(
          { positionId: position.positionId, accountId: account._id },
          {
            userId: account.userId,
            accountId: account._id,
            positionId: position.positionId,
            type: position.type,
            pair: position.symbol,
            openPrice: position.openPrice,
            volume: position.volume,
            openTime: position.openTime,
            profit: position.profit,
            commission: position.commission,
            swap: position.swap,
            status: 'open',
            stopLoss: position.stopLoss,
            takeProfit: position.takeProfit,
            syncedFromMetaAPI: true,
            lastSyncedAt: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      return {
        success: true,
        account,
        positions,
        stats,
      };
    } catch (error) {
      console.error('Error syncing account:', error);
      throw error;
    }
  }

  /**
   * Disconnect account
   */
  async disconnectAccount(accountId) {
    try {
      const account = await TradingAccount.findById(accountId);
      if (!account) throw new Error('Account not found');

      const metaAccount = await this.api.metatraderAccountApi.getAccount(account.metaApiAccountId);
      await metaAccount.undeploy();

      if (this.connections.has(account.metaApiAccountId)) {
        const connection = this.connections.get(account.metaApiAccountId);
        await connection.close();
        this.connections.delete(account.metaApiAccountId);
      }

      account.connectionState = 'UNDEPLOYED';
      account.isActive = false;
      await account.save();

      return { success: true };
    } catch (error) {
      console.error('Error disconnecting account:', error);
      throw error;
    }
  }
}

module.exports = new MetaAPIService();
