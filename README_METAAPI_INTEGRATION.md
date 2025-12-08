# MT4/MT5 Trading Account Integration - Backend Framework

This backend framework enables MT4/MT5 trading account integration via MetaAPI, allowing users to connect their trading accounts, sync trade history, track performance metrics, and maintain a comprehensive trade journal with discipline tracking.

## Overview

The framework consists of:
- **3 Database Models**: TradingAccount, TradeJournal, UserPreferences
- **1 Service Layer**: MetaAPI integration service
- **3 Controllers**: Trading accounts, trade journal, user preferences
- **3 Route Files**: API endpoints for all functionality

### 🔄 Database Persistence Strategy

**Trades are stored ONCE and fetched from database:**

1. **First Sync**: Fetches trade history from MetaAPI → Saves to MongoDB
2. **View Trades**: Reads from database only (NO MetaAPI call)
3. **Calculate Stats**: Uses database data (NO MetaAPI call)
4. **Re-Sync**: Only fetches NEW trades since last sync → Updates database
5. **All Queries**: Always from database, never re-fetch from MetaAPI

This approach:
- ✅ Minimizes MetaAPI API calls
- ✅ Prevents duplicate data
- ✅ Enables fast queries
- ✅ Preserves user annotations (confluences, notes, emotions)
- ✅ Works offline after initial sync

---

## Prerequisites

1. **MetaAPI Account**: Sign up at https://metaapi.cloud/
2. **MetaAPI Token**: Get your API token from MetaAPI dashboard
3. **Environment Variable**: Add `METAAPI_TOKEN=your_token_here` to `.env`

---

## Installation

Install the MetaAPI SDK:

```bash
npm install metaapi.cloud-sdk
```

---

## Database Models

### 1. TradingAccount Model (`models/TradingAccount.js`)

Stores connected MT4/MT5 accounts and cached statistics.

**Fields:**
- `userId`: Reference to User
- `accountName`: Custom name for the account
- `metaApiAccountId`: MetaAPI account ID
- `platform`: 'mt4' or 'mt5'
- `broker`: Broker name
- `login`: Trading account login
- `server`: Broker server
- `connectionState`: DEPLOYED, CONNECTED, UNDEPLOYED, etc.
- `stats`: Object containing:
  - `balance`, `equity`, `margin`, `leverage`
  - `totalTrades`, `winningTrades`, `losingTrades`, `winRate`
  - `monthlyROI`
  - Period profits: `todayProfit`, `weekProfit`, `monthProfit`, `quarterProfit`, `sixMonthsProfit`, `yearProfit`
- `isActive`: Boolean
- `isPrimary`: Boolean (for dashboard default)
- `lastSyncedAt`: Timestamp

---

### 2. TradeJournal Model (`models/TradeJournal.js`)

Stores individual trades with MetaAPI data and user annotations.

**Fields:**
- Trade Data: `positionId`, `ticket`, `type` (Buy/Sell), `pair`, `openPrice`, `closePrice`, `volume`, `openTime`, `closeTime`, `duration`, `profit`, `pips`, `commission`, `swap`
- Status: `open`, `closed`, `pending`
- `outcome`: 'win', 'loss', 'breakeven'
- `userNotes`: Object containing:
  - `strategy`: String
  - `confluences`: Array of strings
  - `emotions`: String
  - `confidence`: Number (1-10)
  - `screenshots`: Array of URLs
  - `postTradeNotes`: String
  - `lessonsLearned`: String
  - `mistakes`: String
  - `didFollowPlan`: Boolean
- `session`: 'London', 'New York', 'Asian', 'Sydney'
- `riskRewardRatio`: Number
- `stopLoss`, `takeProfit`: Numbers
- `syncedFromMetaAPI`: Boolean

---

### 3. UserPreferences Model (`models/UserPreferences.js`)

Stores user's trading preferences and settings.

**Fields:**
- `tradingPreferences`:
  - `preferredPairs`: Array of currency pairs
  - `confluences`: Array of {name, description, category}
  - `strategies`: Array of strategy names
  - `preferredSessions`: Array of session names
  - `maxRiskPerTrade`: Percentage
  - `maxDailyDrawdown`: Percentage
  - `defaultLotSize`: Number
- `dashboardSettings`:
  - `defaultTimeframe`: 'today', 'week', 'month', etc.
  - `primaryAccountId`: Reference to TradingAccount
  - Show flags for various metrics
- `notifications`: Email and push notification preferences

---

## Service Layer

### MetaAPI Service (`services/metaApiService.js`)

Handles all MetaAPI SDK interactions.

**Key Methods:**

1. **`connectAccount(userId, accountData)`**
   - Creates account in MetaAPI
   - Deploys account
   - Saves to database
   - Returns account object

2. **`getConnection(metaApiAccountId)`**
   - Gets or creates MetaAPI connection
   - Waits for synchronization
   - Caches connection

3. **`getAccountInfo(metaApiAccountId)`**
   - Fetches balance, equity, margin, leverage, profit

4. **`getOpenPositions(metaApiAccountId)`**
   - Returns all open trades

5. **`getTradeHistory(metaApiAccountId, startTime, endTime)`**
   - Fetches closed deals within date range

6. **`calculateStats(trades)`**
   - Calculates win rate, profit/loss statistics

7. **`syncAccount(accountId)`**
   - Syncs account info, positions, and history
   - Updates database with latest stats
   - Syncs open positions to TradeJournal

8. **`disconnectAccount(accountId)`**
   - Undeploys account
   - Closes connection

---

## Controllers

### 1. Trading Account Controller (`controllers/tradingAccountController.js`)

**Endpoints:**

- `connectAccount`: Connect new MT4/MT5 account
- `getAccounts`: Get all user's accounts
- `getAccount`: Get specific account details
- `syncAccount`: Sync account data from MetaAPI
- `getAccountStats`: Get account statistics
- `setPrimaryAccount`: Set default account for dashboard
- `disconnectAccount`: Disconnect account
- `deleteAccount`: Delete account
- `getDashboardSummary`: Get aggregated stats across all accounts

---

### 2. Trade Journal Controller (`controllers/tradeJournalController.js`)

**Endpoints:**

- `getTrades`: Get trades with filters (timeframe, pair, session, status)
- `getTrade`: Get specific trade details
- `updateTradeNotes`: Add/update confluences, emotions, strategy, etc.
- `addScreenshots`: Add screenshot URLs to trade
- `getTradeStats`: Calculate statistics (win rate, profit factor, etc.)
- `createManualTrade`: Manually create a trade entry
- `deleteTrade`: Delete manual trades (not MetaAPI synced)

**Statistics Calculated:**
- Total trades, winning/losing trades
- Total profit/loss, net profit
- Average win/loss
- Win rate, profit factor
- Average risk-reward ratio
- Total pips
- Best/worst trades
- Stats by pair and session

---

### 3. User Preferences Controller (`controllers/userPreferencesController.js`)

**Endpoints:**

- `getPreferences`: Get user preferences
- `updateTradingPreferences`: Update preferred pairs, strategies, risk settings
- `addConfluence`: Add custom confluence
- `removeConfluence`: Remove confluence
- `addPreferredPair`: Add preferred currency pair
- `removePreferredPair`: Remove preferred pair
- `updateDashboardSettings`: Update dashboard display settings
- `updateNotificationPreferences`: Update notification settings

---

## API Routes

### Trading Accounts (`/api/trading-accounts`)

```
POST   /connect                    - Connect new account
GET    /                            - Get all accounts
GET    /dashboard-summary           - Get aggregated dashboard stats
GET    /:accountId                  - Get account details
POST   /:accountId/sync             - Sync account from MetaAPI
GET    /:accountId/stats            - Get account statistics
PUT    /:accountId/set-primary      - Set as primary account
POST   /:accountId/disconnect       - Disconnect account
DELETE /:accountId                  - Delete account
```

### Trade Journal (`/api/trade-journal`)

```
GET    /                            - Get all trades (with filters)
GET    /stats                       - Get trade statistics
POST   /manual                      - Create manual trade entry
GET    /:tradeId                    - Get trade details
PUT    /:tradeId/notes              - Update trade notes
POST   /:tradeId/screenshots        - Add screenshots
DELETE /:tradeId                    - Delete trade (manual only)
```

### User Preferences (`/api/user-preferences`)

```
GET    /                            - Get preferences
PUT    /trading                     - Update trading preferences
POST   /confluences                 - Add confluence
DELETE /confluences/:confluenceId   - Remove confluence
POST   /preferred-pairs             - Add preferred pair
DELETE /preferred-pairs/:pair       - Remove preferred pair
PUT    /dashboard                   - Update dashboard settings
PUT    /notifications               - Update notification preferences
```

---

## Usage Flow

### 1. Connect Trading Account

```javascript
POST /api/trading-accounts/connect
Headers: { Authorization: "Bearer <token>" }
Body: {
  "accountName": "My MT4 Account",
  "login": "12345678",
  "password": "password123",
  "server": "ICMarkets-Demo",
  "platform": "mt4",
  "broker": "IC Markets"
}
```

### 2. Sync Account Data

```javascript
POST /api/trading-accounts/:accountId/sync
Headers: { Authorization: "Bearer <token>" }
```

This will:
- Fetch current account balance, equity, margin
- Get open positions
- Get trade history for all time periods
- Calculate statistics (win rate, ROI, etc.)
- Update TradingAccount stats
- Sync open positions to TradeJournal

### 3. Get Dashboard Summary

```javascript
GET /api/trading-accounts/dashboard-summary
Headers: { Authorization: "Bearer <token>" }

Response: {
  "success": true,
  "summary": {
    "totalBalance": 50000,
    "totalEquity": 51200,
    "totalProfit": 1200,
    "winRate": 65.5,
    "monthlyROI": 4.2
  },
  "accounts": [...]
}
```

### 4. Get Trade Journal

```javascript
GET /api/trade-journal?timeframe=month&accountId=xxx&status=closed
Headers: { Authorization: "Bearer <token>" }

Response: {
  "success": true,
  "count": 45,
  "trades": [
    {
      "_id": "...",
      "pair": "EURUSD",
      "type": "Buy",
      "profit": 125.50,
      "pips": 25,
      "openTime": "2024-01-15T10:30:00Z",
      "closeTime": "2024-01-15T14:45:00Z",
      "userNotes": {
        "strategy": "Breakout",
        "confluences": ["Support level", "RSI oversold"],
        "emotions": "Calm and confident"
      }
    },
    ...
  ]
}
```

### 5. Update Trade Notes

```javascript
PUT /api/trade-journal/:tradeId/notes
Headers: { Authorization: "Bearer <token>" }
Body: {
  "strategy": "Trend following",
  "confluences": ["Moving average crossover", "Volume confirmation"],
  "emotions": "Patient, waited for confirmation",
  "confidence": 8,
  "didFollowPlan": true,
  "lessonsLearned": "Entry was well-timed"
}
```

### 6. Get Trade Statistics

```javascript
GET /api/trade-journal/stats?timeframe=month&accountId=xxx
Headers: { Authorization: "Bearer <token>" }

Response: {
  "success": true,
  "stats": {
    "totalTrades": 45,
    "winningTrades": 30,
    "losingTrades": 15,
    "winRate": 66.67,
    "totalProfit": 2500,
    "totalLoss": 800,
    "netProfit": 1700,
    "profitFactor": 3.125,
    "averageWin": 83.33,
    "averageLoss": 53.33,
    "pairStats": {
      "EURUSD": { "trades": 20, "profit": 1200 },
      "GBPUSD": { "trades": 15, "profit": 500 }
    }
  }
}
```

---

## Time Period Filters

All endpoints support these timeframes:
- `today`: Today's trades
- `week`: Last 7 days
- `month`: Current month
- `quarter`: Current quarter
- `sixMonths`: Last 6 months
- `year`: Current year

---

## Features

### Automated Sync
- MetaAPI automatically syncs account balance, equity, positions
- Trade history fetched and stored in TradeJournal
- Open positions tracked in real-time

### Performance Metrics
- Balance, Equity, Margin
- Win Rate, Monthly ROI
- Profit/Loss by time period
- Total trades, winning/losing trades

### Discipline Tracking
- Add confluences (technical/fundamental reasons for trade)
- Track emotions and confidence level
- Note if trading plan was followed
- Add screenshots and post-trade analysis
- Record lessons learned and mistakes

### Statistics & Analytics
- Win rate, profit factor
- Average win/loss
- Best/worst trades
- Performance by currency pair
- Performance by trading session
- Risk-reward ratios

---

## Error Handling

All controllers include try-catch blocks and return consistent error responses:

```javascript
{
  "success": false,
  "message": "Error description"
}
```

---

## Security

- All routes protected with `authenticate` middleware
- User can only access their own accounts and trades
- MetaAPI credentials stored securely
- Cannot delete trades synced from MetaAPI (data integrity)

---

## Next Steps

1. **Install MetaAPI SDK**: `npm install metaapi.cloud-sdk`
2. **Add to .env**: `METAAPI_TOKEN=your_token_here`
3. **Test Connection**: Use POST /api/trading-accounts/connect
4. **Sync Data**: Use POST /api/trading-accounts/:accountId/sync
5. **Build Frontend**: Create UI for dashboard, trade journal, and preferences

---

## Sample Dashboard Data Structure

```javascript
{
  // Account Overview
  balance: 50000,
  equity: 51200,
  margin: 1500,
  freeMargin: 49700,
  profit: 1200,
  
  // Performance Metrics
  totalTrades: 120,
  winningTrades: 78,
  losingTrades: 42,
  winRate: 65.0,
  monthlyROI: 4.2,
  
  // Period Performance
  todayProfit: 150,
  weekProfit: 680,
  monthProfit: 2100,
  quarterProfit: 5500,
  sixMonthsProfit: 9800,
  yearProfit: 12000
}
```

---

## MetaAPI Documentation

For more details on MetaAPI integration:
- Main Docs: https://metaapi.cloud/docs/client/
- REST API: https://metaapi.cloud/docs/client/restApi/
- Streaming API: https://metaapi.cloud/docs/client/streamingApi/
- JavaScript SDK: https://github.com/agiliumtrade-ai/metaapi-node.js-sdk

---

## Support

For issues or questions:
1. Check MetaAPI documentation
2. Review error logs in console
3. Verify METAAPI_TOKEN is set correctly
4. Ensure account credentials are accurate
5. Check network connectivity to MetaAPI servers
