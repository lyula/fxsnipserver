# MT4/MT5 Integration - Complete API Guide for Frontend

## 🎯 Overview

This guide provides **exact API endpoints, request formats, and response structures** for integrating MT4/MT5 trading account functionality into your new website.

**Backend URL**: `https://fxsnipserver-7uw7.onrender.com`

---

## 📋 Prerequisites

### 1. User Authentication
All endpoints require JWT authentication token from your existing auth system.

```javascript
// Login first to get token
POST https://fxsnipserver-7uw7.onrender.com/api/auth/login
Body: {
  "email": "user@example.com",
  "password": "password123"
}

Response: {
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

### 2. Get Demo MT4/MT5 Account
Get free demo account from: **IC Markets**, **Pepperstone**, **XM**, or **FXTM**

You'll receive:
- Login (account number)
- Password
- Server (e.g., "ICMarkets-Demo")
- Platform (MT4 or MT5)

---

## 🔌 API Endpoints - Complete Reference

### **Base URL**: `https://fxsnipserver-7uw7.onrender.com`

**Headers Required for All Requests**:
```javascript
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

---

## 1️⃣ TRADING ACCOUNTS MANAGEMENT

### 1.1 Connect New Trading Account

**Endpoint**: `POST /api/trading-accounts/connect`

**Purpose**: Connect a new MT4/MT5 account to MetaAPI and save to database

**Request Body**:
```json
{
  "accountName": "My Demo Account",
  "login": "12345678",
  "password": "YourPassword123",
  "server": "ICMarkets-Demo",
  "platform": "mt4",
  "broker": "IC Markets"
}
```

**Field Descriptions**:
- `accountName`: Custom name you give this account (string)
- `login`: MT4/MT5 account number from broker (string)
- `password`: MT4/MT5 account password from broker (string)
- `server`: Broker's server name from broker email (string)
- `platform`: Either "mt4" or "mt5" (string, lowercase)
- `broker`: Broker company name (string, optional)

**Success Response** (201):
```json
{
  "success": true,
  "message": "Account connected successfully",
  "account": {
    "_id": "674a5e3f2c1b8d001f9e4a21",
    "userId": "6123456789abcdef12345678",
    "accountName": "My Demo Account",
    "metaApiAccountId": "abc123-def456-ghi789",
    "platform": "mt4",
    "broker": "IC Markets",
    "login": "12345678",
    "server": "ICMarkets-Demo",
    "connectionState": "DEPLOYED",
    "isActive": true,
    "isPrimary": false,
    "stats": {},
    "createdAt": "2024-12-08T10:30:00.000Z",
    "updatedAt": "2024-12-08T10:30:00.000Z"
  }
}
```

**Error Response** (400/500):
```json
{
  "success": false,
  "message": "Missing required fields: accountName, login, password, server, platform"
}
```

**Frontend Implementation Example**:
```javascript
async function connectTradingAccount(accountData) {
  const response = await fetch('https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/connect', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountName: accountData.accountName,
      login: accountData.login,
      password: accountData.password,
      server: accountData.server,
      platform: accountData.platform, // "mt4" or "mt5"
      broker: accountData.broker
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Account connected:', data.account);
    // Save account ID for future use
    return data.account._id;
  } else {
    throw new Error(data.message);
  }
}
```

---

### 1.2 Get All Trading Accounts

**Endpoint**: `GET /api/trading-accounts`

**Purpose**: Retrieve all connected trading accounts for current user

**Request**: No body required

**Success Response** (200):
```json
{
  "success": true,
  "accounts": [
    {
      "_id": "674a5e3f2c1b8d001f9e4a21",
      "accountName": "My Demo Account",
      "platform": "mt4",
      "broker": "IC Markets",
      "login": "12345678",
      "server": "ICMarkets-Demo",
      "connectionState": "CONNECTED",
      "isActive": true,
      "isPrimary": true,
      "stats": {
        "balance": 50000,
        "equity": 51200,
        "margin": 1500,
        "leverage": 100,
        "totalTrades": 120,
        "winningTrades": 78,
        "losingTrades": 42,
        "winRate": 65.0,
        "monthlyROI": 4.2,
        "todayProfit": 150,
        "weekProfit": 680,
        "monthProfit": 2100,
        "quarterProfit": 5500,
        "sixMonthsProfit": 9800,
        "yearProfit": 12000
      },
      "lastSyncedAt": "2024-12-08T10:45:00.000Z",
      "createdAt": "2024-12-08T10:30:00.000Z"
    }
  ]
}
```

**Frontend Implementation**:
```javascript
async function getAllAccounts() {
  const response = await fetch('https://fxsnipserver-7uw7.onrender.com/api/trading-accounts', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  return data.accounts;
}
```

---

### 1.3 Get Single Account Details

**Endpoint**: `GET /api/trading-accounts/:accountId`

**Purpose**: Get detailed information about a specific account

**URL Parameter**: `accountId` - MongoDB ObjectId of the account

**Success Response** (200):
```json
{
  "success": true,
  "account": {
    "_id": "674a5e3f2c1b8d001f9e4a21",
    "accountName": "My Demo Account",
    "platform": "mt4",
    "broker": "IC Markets",
    "stats": { ... },
    "lastSyncedAt": "2024-12-08T10:45:00.000Z"
  }
}
```

**Frontend Implementation**:
```javascript
async function getAccountDetails(accountId) {
  const response = await fetch(
    `https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/${accountId}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  const data = await response.json();
  return data.account;
}
```

---

### 1.4 Sync Account Data from MetaAPI

**Endpoint**: `POST /api/trading-accounts/:accountId/sync`

**Purpose**: Fetch latest data from MetaAPI and update database

**What it does**:
- Fetches current balance, equity, margin from MetaAPI
- Gets all open positions
- Fetches NEW closed trades since last sync
- Calculates statistics (win rate, ROI, profits by period)
- Updates account stats in database
- Saves new trades to TradeJournal

**URL Parameter**: `accountId` - MongoDB ObjectId of the account

**Request**: No body required

**Success Response** (200):
```json
{
  "success": true,
  "message": "Account synced successfully",
  "account": {
    "_id": "674a5e3f2c1b8d001f9e4a21",
    "stats": {
      "balance": 50000,
      "equity": 51200,
      "margin": 1500,
      "freeMargin": 49700,
      "marginLevel": 3413.33,
      "currency": "USD",
      "leverage": 100,
      "profit": 1200,
      "totalTrades": 120,
      "winningTrades": 78,
      "losingTrades": 42,
      "winRate": 65.0,
      "monthlyROI": 4.2,
      "todayProfit": 150,
      "weekProfit": 680,
      "monthProfit": 2100,
      "quarterProfit": 5500,
      "sixMonthsProfit": 9800,
      "yearProfit": 12000
    },
    "lastSyncedAt": "2024-12-08T11:00:00.000Z"
  },
  "stats": {
    "totalTrades": 120,
    "winningTrades": 78,
    "losingTrades": 42,
    "totalProfit": 8500,
    "totalLoss": 3200,
    "netProfit": 5300,
    "winRate": 65.0
  }
}
```

**Frontend Implementation**:
```javascript
async function syncAccount(accountId) {
  const response = await fetch(
    `https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/${accountId}/sync`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  const data = await response.json();
  
  if (data.success) {
    console.log('Account synced. New stats:', data.account.stats);
    return data.account;
  } else {
    throw new Error(data.message);
  }
}

// Usage: Call this when user clicks "Refresh" or "Sync" button
// Recommended: Don't auto-sync too frequently (MetaAPI rate limits)
```

---

### 1.5 Get Dashboard Summary (All Accounts Aggregated)

**Endpoint**: `GET /api/trading-accounts/dashboard-summary`

**Purpose**: Get combined statistics across all active accounts

**Success Response** (200):
```json
{
  "success": true,
  "summary": {
    "totalBalance": 100000,
    "totalEquity": 102400,
    "totalProfit": 2400,
    "winRate": 67.5,
    "monthlyROI": 3.8,
    "totalTrades": 250,
    "winningTrades": 169
  },
  "accounts": [
    {
      "id": "674a5e3f2c1b8d001f9e4a21",
      "accountName": "Demo Account 1",
      "platform": "mt4",
      "stats": { ... },
      "isPrimary": true
    },
    {
      "id": "674a5e3f2c1b8d001f9e4a22",
      "accountName": "Demo Account 2",
      "platform": "mt5",
      "stats": { ... },
      "isPrimary": false
    }
  ]
}
```

**Frontend Implementation**:
```javascript
async function getDashboardSummary() {
  const response = await fetch(
    'https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/dashboard-summary',
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  const data = await response.json();
  
  // Use for dashboard display
  return {
    totalBalance: data.summary.totalBalance,
    totalEquity: data.summary.totalEquity,
    winRate: data.summary.winRate,
    monthlyROI: data.summary.monthlyROI,
    accounts: data.accounts
  };
}
```

---

### 1.6 Set Primary Account

**Endpoint**: `PUT /api/trading-accounts/:accountId/set-primary`

**Purpose**: Set this account as the default for dashboard display

**Success Response** (200):
```json
{
  "success": true,
  "message": "Primary account updated",
  "account": { ... }
}
```

**Frontend Implementation**:
```javascript
async function setPrimaryAccount(accountId) {
  const response = await fetch(
    `https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/${accountId}/set-primary`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  return await response.json();
}
```

---

### 1.7 Disconnect Account

**Endpoint**: `POST /api/trading-accounts/:accountId/disconnect`

**Purpose**: Disconnect account from MetaAPI (can reconnect later)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Account disconnected successfully"
}
```

---

### 1.8 Delete Account

**Endpoint**: `DELETE /api/trading-accounts/:accountId`

**Purpose**: Permanently delete account and all associated data

**Success Response** (200):
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

## 2️⃣ TRADE JOURNAL MANAGEMENT

### 2.1 Get All Trades (with Filters)

**Endpoint**: `GET /api/trade-journal`

**Purpose**: Fetch trades from DATABASE (no MetaAPI call - fast!)

**Query Parameters** (all optional):
- `accountId` - Filter by specific account
- `status` - Filter by status: "open", "closed", "pending"
- `timeframe` - Filter by time: "today", "week", "month", "quarter", "sixMonths", "year"
- `pair` - Filter by currency pair (e.g., "EURUSD")
- `session` - Filter by session: "London", "New York", "Asian", "Sydney"

**Example Requests**:
```
GET /api/trade-journal
GET /api/trade-journal?timeframe=month
GET /api/trade-journal?accountId=674a5e3f2c1b8d001f9e4a21&status=closed
GET /api/trade-journal?timeframe=week&pair=EURUSD
GET /api/trade-journal?session=London&status=closed
```

**Success Response** (200):
```json
{
  "success": true,
  "count": 45,
  "trades": [
    {
      "_id": "674a6f2c8e1d9a002b3c5f12",
      "userId": "6123456789abcdef12345678",
      "accountId": {
        "_id": "674a5e3f2c1b8d001f9e4a21",
        "accountName": "My Demo Account",
        "platform": "mt4"
      },
      "ticket": "987654321",
      "positionId": "pos_12345",
      "type": "Buy",
      "pair": "EURUSD",
      "openPrice": 1.08500,
      "closePrice": 1.08750,
      "volume": 0.10,
      "openTime": "2024-12-01T08:30:00.000Z",
      "closeTime": "2024-12-01T14:45:00.000Z",
      "duration": 22500000,
      "profit": 25.50,
      "pips": 25,
      "commission": -0.50,
      "swap": 0,
      "status": "closed",
      "outcome": "win",
      "stopLoss": 1.08250,
      "takeProfit": 1.08800,
      "riskRewardRatio": 2.0,
      "session": "London",
      "userNotes": {
        "strategy": "Breakout",
        "confluences": ["Support level", "RSI oversold", "Volume spike"],
        "emotions": "Calm and patient",
        "confidence": 8,
        "screenshots": [
          "https://res.cloudinary.com/dfcqwuu0q/image/upload/v1234567890/trade_entry.png"
        ],
        "postTradeNotes": "Perfect entry, followed plan exactly",
        "lessonsLearned": "Waiting for confirmation paid off",
        "mistakes": "",
        "didFollowPlan": true
      },
      "syncedFromMetaAPI": true,
      "lastSyncedAt": "2024-12-08T11:00:00.000Z",
      "createdAt": "2024-12-01T14:45:30.000Z",
      "updatedAt": "2024-12-02T09:15:00.000Z"
    }
  ]
}
```

**Frontend Implementation**:
```javascript
async function getTrades(filters = {}) {
  const params = new URLSearchParams();
  
  if (filters.accountId) params.append('accountId', filters.accountId);
  if (filters.status) params.append('status', filters.status);
  if (filters.timeframe) params.append('timeframe', filters.timeframe);
  if (filters.pair) params.append('pair', filters.pair);
  if (filters.session) params.append('session', filters.session);
  
  const url = `https://fxsnipserver-7uw7.onrender.com/api/trade-journal?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  return data.trades;
}

// Usage examples:
const allTrades = await getTrades();
const thisMonthTrades = await getTrades({ timeframe: 'month' });
const eurusdTrades = await getTrades({ pair: 'EURUSD', status: 'closed' });
const londonTrades = await getTrades({ session: 'London', timeframe: 'week' });
```

---

### 2.2 Get Single Trade Details

**Endpoint**: `GET /api/trade-journal/:tradeId`

**Purpose**: Get detailed information about a specific trade

**Success Response** (200):
```json
{
  "success": true,
  "trade": {
    "_id": "674a6f2c8e1d9a002b3c5f12",
    "accountId": {
      "_id": "674a5e3f2c1b8d001f9e4a21",
      "accountName": "My Demo Account",
      "platform": "mt4",
      "broker": "IC Markets"
    },
    "pair": "EURUSD",
    "profit": 25.50,
    "userNotes": { ... }
  }
}
```

---

### 2.3 Update Trade Notes

**Endpoint**: `PUT /api/trade-journal/:tradeId/notes`

**Purpose**: Add or update user annotations (confluences, emotions, strategy, etc.)

**Request Body** (all fields optional):
```json
{
  "strategy": "Trend following",
  "confluences": ["Moving average crossover", "Volume confirmation", "Support level"],
  "emotions": "Patient, waited for confirmation",
  "confidence": 8,
  "postTradeNotes": "Entry was perfect, exit could have been better",
  "lessonsLearned": "Always wait for volume confirmation",
  "mistakes": "Exited too early, left profit on table",
  "didFollowPlan": true
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Trade notes updated successfully",
  "trade": { ... }
}
```

**Frontend Implementation**:
```javascript
async function updateTradeNotes(tradeId, notes) {
  const response = await fetch(
    `https://fxsnipserver-7uw7.onrender.com/api/trade-journal/${tradeId}/notes`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        strategy: notes.strategy,
        confluences: notes.confluences, // Array of strings
        emotions: notes.emotions,
        confidence: notes.confidence, // Number 1-10
        postTradeNotes: notes.postTradeNotes,
        lessonsLearned: notes.lessonsLearned,
        mistakes: notes.mistakes,
        didFollowPlan: notes.didFollowPlan // Boolean
      })
    }
  );
  
  return await response.json();
}
```

---

### 2.4 Add Screenshots to Trade

**Endpoint**: `POST /api/trade-journal/:tradeId/screenshots`

**Purpose**: Add screenshot URLs (after uploading to Cloudinary)

**Request Body**:
```json
{
  "screenshots": [
    "https://res.cloudinary.com/dfcqwuu0q/image/upload/v1234567890/entry.png",
    "https://res.cloudinary.com/dfcqwuu0q/image/upload/v1234567891/exit.png"
  ]
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Screenshots added successfully",
  "trade": { ... }
}
```

**Frontend Implementation**:
```javascript
// First upload to Cloudinary (using your existing upload function)
// Then add URLs to trade
async function addTradeScreenshots(tradeId, screenshotUrls) {
  const response = await fetch(
    `https://fxsnipserver-7uw7.onrender.com/api/trade-journal/${tradeId}/screenshots`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        screenshots: screenshotUrls // Array of Cloudinary URLs
      })
    }
  );
  
  return await response.json();
}
```

---

### 2.5 Get Trade Statistics

**Endpoint**: `GET /api/trade-journal/stats`

**Purpose**: Calculate comprehensive statistics from DATABASE trades

**Query Parameters** (optional):
- `accountId` - Stats for specific account
- `timeframe` - "today", "week", "month", "quarter", "sixMonths", "year"

**Example Requests**:
```
GET /api/trade-journal/stats
GET /api/trade-journal/stats?timeframe=month
GET /api/trade-journal/stats?accountId=674a5e3f2c1b8d001f9e4a21&timeframe=week
```

**Success Response** (200):
```json
{
  "success": true,
  "stats": {
    "totalTrades": 120,
    "winningTrades": 78,
    "losingTrades": 42,
    "totalProfit": 8500,
    "totalLoss": 3200,
    "netProfit": 5300,
    "averageWin": 108.97,
    "averageLoss": 76.19,
    "winRate": 65.0,
    "profitFactor": 2.66,
    "averageRR": 1.85,
    "totalPips": 1250,
    "bestTrade": {
      "id": "674a6f2c8e1d9a002b3c5f12",
      "pair": "EURUSD",
      "profit": 450
    },
    "worstTrade": {
      "id": "674a6f2c8e1d9a002b3c5f13",
      "pair": "GBPUSD",
      "profit": -220
    },
    "pairStats": {
      "EURUSD": {
        "trades": 50,
        "profit": 2500
      },
      "GBPUSD": {
        "trades": 40,
        "profit": 1800
      },
      "USDJPY": {
        "trades": 30,
        "profit": 1000
      }
    },
    "sessionStats": {
      "London": {
        "trades": 60,
        "profit": 3200
      },
      "New York": {
        "trades": 45,
        "profit": 1800
      },
      "Asian": {
        "trades": 15,
        "profit": 300
      }
    }
  }
}
```

**Frontend Implementation**:
```javascript
async function getTradeStatistics(accountId = null, timeframe = null) {
  const params = new URLSearchParams();
  if (accountId) params.append('accountId', accountId);
  if (timeframe) params.append('timeframe', timeframe);
  
  const url = `https://fxsnipserver-7uw7.onrender.com/api/trade-journal/stats?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  
  const data = await response.json();
  return data.stats;
}

// Usage:
const monthStats = await getTradeStatistics(null, 'month');
console.log(`Win Rate: ${monthStats.winRate}%`);
console.log(`Profit Factor: ${monthStats.profitFactor}`);
console.log(`Best Pair: ${Object.keys(monthStats.pairStats)[0]}`);
```

---

### 2.6 Create Manual Trade Entry

**Endpoint**: `POST /api/trade-journal/manual`

**Purpose**: Manually add a trade (not synced from MetaAPI)

**Request Body**:
```json
{
  "accountId": "674a5e3f2c1b8d001f9e4a21",
  "type": "Buy",
  "pair": "EURUSD",
  "openPrice": 1.08500,
  "closePrice": 1.08750,
  "volume": 0.10,
  "openTime": "2024-12-08T10:00:00.000Z",
  "closeTime": "2024-12-08T15:30:00.000Z",
  "profit": 25.50,
  "pips": 25,
  "stopLoss": 1.08250,
  "takeProfit": 1.08800,
  "session": "London",
  "userNotes": {
    "strategy": "Breakout",
    "confluences": ["Support level"],
    "emotions": "Confident"
  }
}
```

**Required Fields**: `accountId`, `type`, `pair`, `openPrice`, `volume`, `openTime`

**Success Response** (201):
```json
{
  "success": true,
  "message": "Trade created successfully",
  "trade": { ... }
}
```

---

### 2.7 Delete Trade

**Endpoint**: `DELETE /api/trade-journal/:tradeId`

**Purpose**: Delete a trade (only manual trades, NOT MetaAPI synced trades)

**Success Response** (200):
```json
{
  "success": true,
  "message": "Trade deleted successfully"
}
```

**Error if synced from MetaAPI** (403):
```json
{
  "success": false,
  "message": "Cannot delete trades synced from MetaAPI"
}
```

---

## 3️⃣ USER PREFERENCES MANAGEMENT

### 3.1 Get User Preferences

**Endpoint**: `GET /api/user-preferences`

**Purpose**: Get all user preferences (auto-creates default if not exists)

**Success Response** (200):
```json
{
  "success": true,
  "preferences": {
    "_id": "674a7f3c9e2d0a003c4d6e23",
    "userId": "6123456789abcdef12345678",
    "tradingPreferences": {
      "preferredPairs": ["EURUSD", "GBPUSD", "USDJPY"],
      "confluences": [
        {
          "_id": "674a7f3c9e2d0a003c4d6e24",
          "name": "Support/Resistance",
          "description": "Price at key S/R level",
          "category": "Technical"
        },
        {
          "_id": "674a7f3c9e2d0a003c4d6e25",
          "name": "RSI Oversold",
          "description": "RSI below 30",
          "category": "Technical"
        }
      ],
      "strategies": ["Breakout", "Trend Following", "Mean Reversion"],
      "preferredSessions": ["London", "New York"],
      "maxRiskPerTrade": 2,
      "maxDailyDrawdown": 5,
      "defaultLotSize": 0.01
    },
    "dashboardSettings": {
      "defaultTimeframe": "month",
      "primaryAccountId": "674a5e3f2c1b8d001f9e4a21",
      "showBalance": true,
      "showEquity": true,
      "showProfit": true,
      "showWinRate": true,
      "showROI": true
    },
    "notifications": {
      "emailOnTradeClose": false,
      "emailOnDailyReport": true,
      "emailOnWeeklyReport": true,
      "pushOnTradeClose": false,
      "pushOnAccountSync": false
    }
  }
}
```

**Frontend Implementation**:
```javascript
async function getUserPreferences() {
  const response = await fetch(
    'https://fxsnipserver-7uw7.onrender.com/api/user-preferences',
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }
  );
  
  const data = await response.json();
  return data.preferences;
}
```

---

### 3.2 Update Trading Preferences

**Endpoint**: `PUT /api/user-preferences/trading`

**Purpose**: Update trading-related preferences

**Request Body** (all optional):
```json
{
  "preferredPairs": ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD"],
  "strategies": ["Breakout", "Trend Following"],
  "preferredSessions": ["London", "New York"],
  "maxRiskPerTrade": 2,
  "maxDailyDrawdown": 5,
  "defaultLotSize": 0.01
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Trading preferences updated",
  "preferences": { ... }
}
```

---

### 3.3 Add Custom Confluence

**Endpoint**: `POST /api/user-preferences/confluences`

**Purpose**: Add a custom confluence/setup indicator

**Request Body**:
```json
{
  "name": "EMA Crossover",
  "description": "50 EMA crosses above 200 EMA",
  "category": "Technical"
}
```

**Success Response** (201):
```json
{
  "success": true,
  "message": "Confluence added successfully",
  "preferences": { ... }
}
```

**Frontend Implementation**:
```javascript
async function addConfluence(name, description, category = 'Technical') {
  const response = await fetch(
    'https://fxsnipserver-7uw7.onrender.com/api/user-preferences/confluences',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        description: description,
        category: category // "Technical", "Fundamental", "Sentiment", etc.
      })
    }
  );
  
  return await response.json();
}
```

---

### 3.4 Remove Confluence

**Endpoint**: `DELETE /api/user-preferences/confluences/:confluenceId`

**Success Response** (200):
```json
{
  "success": true,
  "message": "Confluence removed successfully",
  "preferences": { ... }
}
```

---

### 3.5 Add Preferred Pair

**Endpoint**: `POST /api/user-preferences/preferred-pairs`

**Request Body**:
```json
{
  "pair": "EURJPY"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Preferred pair added",
  "preferences": { ... }
}
```

---

### 3.6 Remove Preferred Pair

**Endpoint**: `DELETE /api/user-preferences/preferred-pairs/:pair`

**Example**: `DELETE /api/user-preferences/preferred-pairs/EURJPY`

---

### 3.7 Update Dashboard Settings

**Endpoint**: `PUT /api/user-preferences/dashboard`

**Request Body** (all optional):
```json
{
  "defaultTimeframe": "month",
  "primaryAccountId": "674a5e3f2c1b8d001f9e4a21",
  "showBalance": true,
  "showEquity": true,
  "showProfit": true,
  "showWinRate": true,
  "showROI": true
}
```

---

### 3.8 Update Notification Preferences

**Endpoint**: `PUT /api/user-preferences/notifications`

**Request Body** (all optional):
```json
{
  "emailOnTradeClose": false,
  "emailOnDailyReport": true,
  "emailOnWeeklyReport": true,
  "pushOnTradeClose": false,
  "pushOnAccountSync": false
}
```

---

## 🎨 COMPLETE FRONTEND WORKFLOW EXAMPLE

### Dashboard Page

```javascript
// Dashboard.jsx or Dashboard.tsx

import { useState, useEffect } from 'react';

const API_BASE = 'https://fxsnipserver-7uw7.onrender.com';

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('month');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      
      // Get dashboard summary
      const response = await fetch(`${API_BASE}/api/trading-accounts/dashboard-summary`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setSummary(data.summary);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  async function syncAccount(accountId) {
    try {
      const response = await fetch(`${API_BASE}/api/trading-accounts/${accountId}/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Account synced successfully!');
        loadDashboard(); // Reload dashboard
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Trading Dashboard</h1>
      
      {/* Account Summary */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Balance</h3>
          <p>${summary.totalBalance.toLocaleString()}</p>
        </div>
        
        <div className="stat-card">
          <h3>Total Equity</h3>
          <p>${summary.totalEquity.toLocaleString()}</p>
        </div>
        
        <div className="stat-card">
          <h3>Win Rate</h3>
          <p>{summary.winRate.toFixed(1)}%</p>
        </div>
        
        <div className="stat-card">
          <h3>Monthly ROI</h3>
          <p>{summary.monthlyROI.toFixed(1)}%</p>
        </div>
      </div>
      
      {/* Sync Button */}
      <button onClick={() => syncAccount(summary.accounts[0].id)}>
        Sync Account
      </button>
    </div>
  );
}
```

---

### Trade Journal Page

```javascript
// TradeJournal.jsx

import { useState, useEffect } from 'react';

const API_BASE = 'https://fxsnipserver-7uw7.onrender.com';

function TradeJournal() {
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    timeframe: 'month',
    status: 'closed'
  });

  useEffect(() => {
    loadTrades();
    loadStats();
  }, [filters]);

  async function loadTrades() {
    const params = new URLSearchParams(filters);
    
    const response = await fetch(`${API_BASE}/api/trade-journal?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    setTrades(data.trades);
  }

  async function loadStats() {
    const params = new URLSearchParams({ timeframe: filters.timeframe });
    
    const response = await fetch(`${API_BASE}/api/trade-journal/stats?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    const data = await response.json();
    setStats(data.stats);
  }

  async function updateTradeNotes(tradeId, notes) {
    const response = await fetch(`${API_BASE}/api/trade-journal/${tradeId}/notes`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(notes)
    });
    
    if (response.ok) {
      loadTrades(); // Reload trades
    }
  }

  return (
    <div>
      <h1>Trade Journal</h1>
      
      {/* Filters */}
      <div className="filters">
        <select 
          value={filters.timeframe}
          onChange={(e) => setFilters({...filters, timeframe: e.target.value})}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">Quarter</option>
          <option value="sixMonths">6 Months</option>
          <option value="year">Year</option>
        </select>
      </div>
      
      {/* Statistics */}
      {stats && (
        <div className="stats-summary">
          <p>Total Trades: {stats.totalTrades}</p>
          <p>Win Rate: {stats.winRate.toFixed(1)}%</p>
          <p>Profit Factor: {stats.profitFactor.toFixed(2)}</p>
          <p>Net Profit: ${stats.netProfit.toFixed(2)}</p>
        </div>
      )}
      
      {/* Trades Table */}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Pair</th>
            <th>Type</th>
            <th>Profit</th>
            <th>Pips</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {trades.map(trade => (
            <tr key={trade._id}>
              <td>{new Date(trade.openTime).toLocaleDateString()}</td>
              <td>{trade.pair}</td>
              <td>{trade.type}</td>
              <td className={trade.profit > 0 ? 'profit' : 'loss'}>
                ${trade.profit.toFixed(2)}
              </td>
              <td>{trade.pips}</td>
              <td>
                <button onClick={() => openEditModal(trade)}>
                  Add Notes
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## ⚡ QUICK START CHECKLIST

### Backend Setup (Server)
- [x] MetaAPI token added to `.env`
- [ ] Install SDK: `npm install metaapi.cloud-sdk`
- [ ] Restart server
- [ ] Verify routes are loaded

### Get Demo Account
- [ ] Visit IC Markets demo signup
- [ ] Receive login, password, server via email
- [ ] Save credentials

### Test Connection
- [ ] Login to your app (get JWT token)
- [ ] Call `POST /api/trading-accounts/connect`
- [ ] Call `POST /api/trading-accounts/:id/sync`
- [ ] Call `GET /api/trade-journal`
- [ ] Verify trades appear in database

### Frontend Integration
- [ ] Create dashboard page
- [ ] Display balance, equity, win rate, ROI
- [ ] Add sync button
- [ ] Create trade journal page
- [ ] Display trades in table
- [ ] Add filters (timeframe, pair, session)
- [ ] Create trade detail modal
- [ ] Add form to update notes/confluences

---

## 📊 DATA FLOW SUMMARY

```
1. User connects MT4/MT5 account
   → Frontend: POST /api/trading-accounts/connect
   → Backend: Creates account in MetaAPI
   → Database: Saves TradingAccount document

2. User clicks "Sync"
   → Frontend: POST /api/trading-accounts/:id/sync
   → Backend: Fetches data from MetaAPI
   → Backend: Saves NEW trades to TradeJournal
   → Backend: Updates account stats
   → Database: Updated

3. User views dashboard
   → Frontend: GET /api/trading-accounts/dashboard-summary
   → Backend: Reads from DATABASE only (no MetaAPI call)
   → Frontend: Displays balance, equity, win rate, ROI

4. User views trade journal
   → Frontend: GET /api/trade-journal?timeframe=month
   → Backend: Reads from DATABASE only (no MetaAPI call)
   → Frontend: Displays trades in table

5. User adds notes to trade
   → Frontend: PUT /api/trade-journal/:id/notes
   → Backend: Updates TradeJournal document
   → Database: User notes saved forever

6. User views statistics
   → Frontend: GET /api/trade-journal/stats?timeframe=month
   → Backend: Calculates from DATABASE (no MetaAPI call)
   → Frontend: Displays win rate, profit factor, etc.
```

---

## 🚨 IMPORTANT NOTES

### Rate Limiting
- Don't sync too frequently (max once per minute recommended)
- Free tier has rate limits
- Implement cooldown on sync button

### Error Handling
- Always check `success` field in response
- Display `message` to user on error
- Handle network failures gracefully

### Security
- Never expose MetaAPI token in frontend
- Always use JWT authentication
- Validate user ownership of accounts/trades

### Performance
- Trades are cached in database (fast queries)
- Only sync when user explicitly requests
- Use filters to limit data fetched

---

## 📞 SUPPORT

- Backend Issues: Check server logs
- MetaAPI Issues: https://metaapi.cloud/docs/
- Database Issues: Check MongoDB connection

---

**You're ready to integrate MT4/MT5 functionality into your new website!** 🚀

All APIs are live at: `https://fxsnipserver-7uw7.onrender.com`
