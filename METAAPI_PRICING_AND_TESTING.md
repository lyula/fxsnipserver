# MetaAPI Pricing & Testing Guide

## 🆓 FREE TIER (Great for Testing!)

**YES, you can test for FREE!** MetaAPI offers a generous free tier that's perfect for development and testing.

### Free Tier Includes:
- ✅ **1 MetaTrader account** connection (MT4 or MT5)
- ✅ **Unlimited API calls** (no call limits)
- ✅ **Real-time streaming** (position updates, account info)
- ✅ **Trade history access** (past deals and orders)
- ✅ **30-day historical data** retention
- ✅ **All core features** available
- ✅ **No credit card required** for signup

### Free Tier Limitations:
- ❌ Only 1 account can be connected at a time
- ❌ Limited to 30 days of historical data
- ❌ No priority support
- ❌ Cannot use advanced features (CopyFactory, Risk Management)

**Perfect for:** Development, testing, single account users, proof of concept

---

## 💳 PAID TIERS (For Production Use)

### Cloud Hosting Plans

#### **Basic Plan - $49/month**
- 5 MetaTrader accounts
- Unlimited API calls
- 90 days historical data
- Email support
- All core API features

#### **Pro Plan - $149/month**
- 20 MetaTrader accounts
- Unlimited API calls
- 1 year historical data
- Priority email support
- Advanced features included

#### **Premium Plan - $499/month**
- 100 MetaTrader accounts
- Unlimited API calls
- 5 years historical data
- Priority support + Slack channel
- All features included
- Custom solutions available

---

## 🧪 HOW TO TEST FOR FREE

### Step 1: Create Free MetaAPI Account
1. Go to https://metaapi.cloud/
2. Click "Sign Up" (no credit card needed)
3. Verify your email
4. Get your **API Token** from dashboard

### Step 2: Get a Demo Trading Account
You need an MT4 or MT5 demo account from any broker:

**Recommended Brokers for Testing:**
- **IC Markets** (icmarkets.com) - Popular, easy demo setup
- **Pepperstone** (pepperstone.com) - Good for testing
- **XM** (xm.com) - Quick demo account creation
- **FXTM** (fxtm.com) - Reliable demo servers

**How to get a demo account:**
1. Visit broker's website
2. Click "Open Demo Account"
3. Fill in details (name, email, phone)
4. Choose:
   - Platform: **MT4** or **MT5**
   - Account Type: Standard or Demo
   - Currency: USD (or your preference)
   - Leverage: 1:100 or 1:500
   - Balance: $10,000 (demo money)
5. Receive login credentials via email:
   - **Login** (account number)
   - **Password**
   - **Server** (e.g., "ICMarkets-Demo")

### Step 3: Connect to MetaAPI (FREE)
```javascript
POST https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/connect
Headers: { Authorization: "Bearer <your_jwt_token>" }
Body: {
  "accountName": "My Demo Account",
  "login": "12345678",          // From broker email
  "password": "DemoPass123",     // From broker email
  "server": "ICMarkets-Demo",    // From broker email
  "platform": "mt4",             // or "mt5"
  "broker": "IC Markets"
}
```

### Step 4: Sync Data (FREE)
```javascript
POST https://fxsnipserver-7uw7.onrender.com/api/trading-accounts/:accountId/sync
Headers: { Authorization: "Bearer <your_jwt_token>" }
```

### Step 5: View Trade Journal (FREE)
```javascript
GET https://fxsnipserver-7uw7.onrender.com/api/trade-journal?timeframe=month
Headers: { Authorization: "Bearer <your_jwt_token>" }
```

---

## 📊 WHAT YOU CAN TEST FOR FREE

### ✅ Account Connection
- Connect your demo MT4/MT5 account
- Verify connection status
- Disconnect/reconnect

### ✅ Real-time Data
- Live account balance
- Current equity and margin
- Open positions (if any)
- Profit/loss tracking

### ✅ Trade History
- Past 30 days of trades (free tier limit)
- Trade details (entry/exit, profit, pips)
- Win/loss tracking

### ✅ Statistics
- Win rate calculation
- Monthly ROI
- Profit by time period
- Performance by currency pair

### ✅ Trade Journal Features
- Add confluences to trades
- Record emotions and strategies
- Upload screenshots
- Add post-trade notes

### ✅ User Preferences
- Set preferred pairs
- Create custom confluences
- Define risk parameters
- Dashboard settings

---

## 🚀 TESTING WORKFLOW

### Day 1: Setup
1. Sign up for MetaAPI (free)
2. Get demo account from broker (free)
3. Add `METAAPI_TOKEN` to `.env`
4. Install SDK: `npm install metaapi.cloud-sdk`
5. Connect demo account via API

### Day 2-7: Test Core Features
1. Sync account data
2. View dashboard metrics
3. Check trade history
4. Add notes to trades
5. Test filters (timeframe, pair)
6. Calculate statistics

### Week 2: Test Advanced Features
1. Connect/disconnect multiple times
2. Test with live demo trading
3. Add confluences and strategies
4. Upload screenshots
5. Test all time periods
6. Verify data persistence

### Week 3-4: Stress Testing
1. Sync frequently
2. Test with many trades
3. Test error handling
4. Verify database optimization
5. Check API rate limits

---

## 💡 TIPS FOR FREE TESTING

### 1. Generate Demo Trades
Most brokers allow you to place demo trades:
- Open MT4/MT5 desktop app
- Login with demo credentials
- Place some buy/sell trades
- Close trades for profit/loss
- Sync to see them in your app

### 2. Use Multiple Brokers
If you need to test multiple accounts:
- Get demo from IC Markets (Account 1)
- Delete it from MetaAPI
- Get demo from Pepperstone (Account 2)
- Connect new account

### 3. Monitor Free Tier Limits
- Free tier = 1 account at a time
- Delete old account before adding new
- 30 days historical data only
- Upgrade when ready for production

### 4. Test Without Trading
Even without active trading:
- Account balance/equity syncs
- Statistics calculate correctly
- Dashboard displays properly
- Database persistence works

---

## 🔄 DATABASE PERSISTENCE (YOUR QUESTION!)

### How It Works:

#### ✅ First Sync (Calls MetaAPI)
```javascript
POST /api/trading-accounts/:accountId/sync

MetaAPI Call:
- Fetches trade history since last sync (or from year start)
- Checks each trade against database
- Only inserts NEW trades (no duplicates)
- Saves to TradeJournal collection
```

#### ✅ Subsequent Fetches (Database Only)
```javascript
GET /api/trade-journal?timeframe=month

NO MetaAPI Call:
- Reads directly from MongoDB
- Filters by timeframe/pair/session
- Calculates statistics from DB data
- Returns cached results instantly
```

#### ✅ Re-Sync (Incremental Only)
```javascript
POST /api/trading-accounts/:accountId/sync (again)

Smart MetaAPI Call:
- Finds last synced trade's closeTime
- Only fetches trades AFTER that date
- Avoids re-fetching old trades
- Inserts only new trades
```

### Data Flow:
```
1. User connects account → Saved to DB (TradingAccount)
2. User syncs account → Fetches from MetaAPI → Saves to DB (TradeJournal)
3. User views trades → Reads from DB only (NO MetaAPI call)
4. User views stats → Calculates from DB only (NO MetaAPI call)
5. User syncs again → Fetches NEW trades only → Updates DB
6. User views trades → Still reads from DB only
```

### Why This Is Efficient:
- ✅ Trades stored once, read many times
- ✅ No duplicate data
- ✅ Fast queries (database index)
- ✅ Reduced MetaAPI calls
- ✅ Works offline after first sync
- ✅ User annotations persist forever

---

## 📈 WHEN TO UPGRADE TO PAID

### Stay on Free If:
- Testing/development only
- Single personal account
- Don't need >30 days history
- Low trading volume

### Upgrade to Paid When:
- Multiple trading accounts (>1)
- Need longer history (90 days, 1 year, etc.)
- Production/commercial use
- Serving multiple users
- Need priority support

---

## 🎯 SUMMARY

**Can you test for free?**  
✅ **YES!** MetaAPI's free tier is perfect for testing all functionality.

**Do trades get saved once?**  
✅ **YES!** Trades are:
- Fetched from MetaAPI during sync
- Saved to your MongoDB database
- Retrieved from database for all subsequent requests
- Never duplicated (checked by ticket number)
- Incrementally updated (only new trades fetched)

**What you need:**
1. Free MetaAPI account (no card needed)
2. Free demo trading account (from any broker)
3. Your backend API token

**You're ready to test!** 🚀

---

## 📞 SUPPORT & RESOURCES

- MetaAPI Docs: https://metaapi.cloud/docs/client/
- Pricing Page: https://metaapi.cloud/pricing/
- SDK GitHub: https://github.com/agiliumtrade-ai/metaapi-node.js-sdk
- Support: support@metaapi.cloud
- Community: https://discord.gg/metaapi

