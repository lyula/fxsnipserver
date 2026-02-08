const TradingAccount = require('../models/TradingAccount');
const TradeJournal = require('../models/TradeJournal');
const EAApiKey = require('../models/EAApiKey');
const { calcPips } = require('../utils/pips');

const MAX_TRADES_PER_REQUEST = 500;

function normalizeType(t) {
  if (t === 'buy' || t === 'Buy') return 'Buy';
  if (t === 'sell' || t === 'Sell') return 'Sell';
  return null;
}

function outcomeFromProfit(profit) {
  if (profit == null) return 'pending';
  if (profit > 0) return 'profit';
  if (profit < 0) return 'loss';
  return 'breakeven';
}

function parseDate(v) {
  if (v == null) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/ea/push-trades
 * Body: { platform, accountLogin, server, trades[] }
 * Auth: API key only. Key is tied to one account; body must match that account.
 */
exports.pushTrades = async (req, res) => {
  try {
    const keyDoc = req.eaKeyDoc;
    const accountId = keyDoc.accountId;
    const userId = keyDoc.userId;

    const { platform, accountLogin, server, trades, balance, equity } = req.body;

    if (!platform || !accountLogin || !server) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: platform, accountLogin, server',
      });
    }
    const platformNorm = platform.toLowerCase();
    if (!['mt4', 'mt5'].includes(platformNorm)) {
      return res.status(400).json({
        success: false,
        message: 'platform must be mt4 or mt5',
      });
    }
    if (!Array.isArray(trades)) {
      return res.status(400).json({
        success: false,
        message: 'trades must be an array',
      });
    }
    if (trades.length > MAX_TRADES_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        message: `trades array must have at most ${MAX_TRADES_PER_REQUEST} items`,
      });
    }

    const account = await TradingAccount.findOne({ _id: accountId, userId });
    if (!account || account.source !== 'ea') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or revoked API key',
      });
    }

    if (
      String(account.login) !== String(accountLogin) ||
      String(account.server) !== String(server) ||
      account.platform !== platformNorm
    ) {
      return res.status(400).json({
        success: false,
        message: 'accountLogin, server and platform must match the account this API key belongs to',
      });
    }

    const results = { accepted: 0, updated: 0, created: 0, errors: [] };

    for (let i = 0; i < trades.length; i++) {
      const t = trades[i];
      const ticket = t.ticket != null ? String(t.ticket) : null;
      if (!ticket) {
        results.errors.push({ index: i, ticket: ticket, message: 'ticket is required' });
        continue;
      }
      const type = normalizeType(t.type);
      if (!type) {
        results.errors.push({ index: i, ticket, message: 'type must be buy or sell' });
        continue;
      }
      if (!t.pair || typeof t.openPrice !== 'number' || typeof t.volume !== 'number') {
        results.errors.push({ index: i, ticket, message: 'pair, openPrice, and volume are required' });
        continue;
      }
      const openTime = parseDate(t.openTime);
      if (!openTime) {
        results.errors.push({ index: i, ticket, message: 'openTime is required and must be valid ISO 8601' });
        continue;
      }
      const status = (t.status && ['open', 'closed', 'pending'].includes(t.status.toLowerCase()))
        ? t.status.toLowerCase()
        : 'open';

      const closeTime = parseDate(t.closeTime);
      const profit = typeof t.profit === 'number' ? t.profit : 0;
      const outcome = outcomeFromProfit(profit);
      const closePrice = typeof t.closePrice === 'number' ? t.closePrice : undefined;
      const commission = typeof t.commission === 'number' ? t.commission : 0;
      const swap = typeof t.swap === 'number' ? t.swap : 0;
      const stopLoss = typeof t.stopLoss === 'number' ? t.stopLoss : undefined;
      const takeProfit = typeof t.takeProfit === 'number' ? t.takeProfit : undefined;
      const positionId = t.positionId != null ? String(t.positionId) : undefined;

      let duration;
      if (closeTime && openTime) {
        duration = Math.round((closeTime - openTime) / (60 * 1000));
      } else if (typeof t.duration === 'number') {
        duration = t.duration;
      }

      const pairStr = String(t.pair);
      const pipsValue = typeof t.pips === 'number' && t.pips !== 0
        ? t.pips
        : (closePrice != null ? calcPips(type, t.openPrice, closePrice, pairStr) : 0);

      const payload = {
        userId,
        accountId,
        ticket,
        positionId,
        type,
        pair: pairStr,
        openPrice: t.openPrice,
        closePrice,
        volume: t.volume,
        openTime,
        closeTime,
        duration,
        profit,
        commission,
        swap,
        stopLoss,
        takeProfit,
        status,
        outcome,
        pips: pipsValue,
        syncedFromEA: true,
        lastSyncedAt: new Date(),
      };

      const existing = await TradeJournal.findOne({ accountId, ticket });
      if (existing) {
        await TradeJournal.updateOne(
          { accountId, ticket },
          { $set: payload }
        );
        results.updated++;
      } else {
        await TradeJournal.create(payload);
        results.created++;
      }
      results.accepted++;
    }

    const accountUpdate = { lastSyncedAt: new Date() };
    if (typeof balance === 'number') {
      accountUpdate['stats.balance'] = balance;
    }
    if (typeof equity === 'number') {
      accountUpdate['stats.equity'] = equity;
    }
    await TradingAccount.updateOne(
      { _id: accountId },
      { $set: accountUpdate }
    );

    if (keyDoc._id) {
      await EAApiKey.updateOne({ _id: keyDoc._id }, { $set: { lastUsedAt: new Date() } });
    }

    res.status(200).json({
      success: true,
      accepted: results.accepted,
      updated: results.updated,
      created: results.created,
      errors: results.errors,
    });
  } catch (error) {
    console.error('EA push-trades error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process trades',
    });
  }
};
