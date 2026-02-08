# EA trade sync — single reference (backend + frontend)

**Backend URL:** `https://fxsnipserver-7uw7.onrender.com`

Give this document to the frontend team. It contains: what the backend does, API details, exact URLs, frontend implementation steps, and user instructions.

---

## 1. What the backend does

- **One API key per EA-linked account.** User creates an “EA account” (no MetaAPI, no password), then gets an API key for that account. The EA in MetaTrader uses that key to push trades.
- **Push endpoint:** the EA sends `POST /api/ea/push-trades` with the API key in the header and a JSON body. Backend upserts trades by `(accountId, ticket)` and returns `accepted`, `updated`, `created`, `errors`.
- **EA file downloads:** the server serves the EA source files from `/ea/`. Users download the .mq4 (MT4) or .mq5 (MT5) file and install it in MetaTrader.

---

## 2. URLs (use same base for API and EA links)

| Use | URL |
|-----|-----|
| API base (all requests) | `https://fxsnipserver-7uw7.onrender.com` |
| Create EA account | `POST https://fxsnipserver-7uw7.onrender.com/api/trading-account/connect-ea` |
| Get API key | `GET https://fxsnipserver-7uw7.onrender.com/api/trading-account/:accountId/ea-api-key` |
| Regenerate API key | `POST https://fxsnipserver-7uw7.onrender.com/api/trading-account/:accountId/ea-api-key/regenerate` |
| Push trades (EA only) | `POST https://fxsnipserver-7uw7.onrender.com/api/ea/push-trades` |
| Download MT4 EA | `https://fxsnipserver-7uw7.onrender.com/ea/TradeJournalSync.mq4` |
| Download MT5 EA | `https://fxsnipserver-7uw7.onrender.com/ea/TradeJournalSync.mq5` |

Frontend should use one base URL (e.g. from env `VITE_API_URL`): `${base}/api/...` for API, `${base}/ea/TradeJournalSync.mq4` and `${base}/ea/TradeJournalSync.mq5` for downloads.

---

## 3. API details

### 3.1 Create EA account (JWT)

- **POST** `/api/trading-account/connect-ea`
- **Headers:** `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Body:** `{ "accountName": "My EA", "login": "12345678", "server": "Broker-Server", "platform": "mt4", "broker": "Optional" }`
- **Response 201:** `{ "success": true, "account": { "_id", "source": "ea", ... } }`

### 3.2 Get API key (JWT)

- **GET** `/api/trading-account/:accountId/ea-api-key` — `accountId` = EA account `_id`
- **Response:** If no key yet: `{ "success": true, "apiKey": "fxj_...", "key": { "id", "keyPrefix", "lastUsedAt", "createdAt" } }`. If key exists: `{ "success": true, "key": { ... } }` (no `apiKey`). Show `apiKey` once with a “Copy” button; afterwards only show key metadata and “Regenerate key”.

### 3.3 Regenerate API key (JWT)

- **POST** `/api/trading-account/:accountId/ea-api-key/regenerate`
- **Response:** `{ "success": true, "apiKey": "fxj_...", "key": { ... } }` — show new `apiKey` once; old key stops working immediately.

### 3.4 Push trades (API key only — used by the EA)

- **POST** `/api/ea/push-trades`
- **Headers:** `Authorization: Bearer <api_key>` or `X-API-Key: <api_key>`, `Content-Type: application/json`
- **Body:**
```json
{
  "platform": "mt4",
  "accountLogin": "12345678",
  "server": "Broker-Server",
  "trades": [
    {
      "ticket": "123456789",
      "type": "buy",
      "pair": "EURUSD",
      "openPrice": 1.085,
      "closePrice": 1.087,
      "volume": 0.1,
      "openTime": "2025-02-08T10:00:00.000Z",
      "closeTime": "2025-02-08T12:30:00.000Z",
      "profit": 20.5,
      "commission": -0.5,
      "swap": 0,
      "stopLoss": 1.08,
      "takeProfit": 1.09,
      "status": "closed"
    }
  ]
}
```
- **Required per trade:** `ticket`, `type` (buy/sell), `pair`, `openPrice`, `volume`, `openTime`, `status` (open/closed/pending). Optional: `positionId`, `closePrice`, `closeTime`, `profit`, `commission`, `swap`, `stopLoss`, `takeProfit`.
- **Optional in body:** `balance`, `equity` (numbers). If sent, the backend stores them on the account so “balance after each trade” can be returned in the journal. The EAs send these automatically.
- **Response 200:** `{ "success": true, "accepted", "updated", "created", "errors": [] }`. **401** = invalid/revoked key. **400** = body invalid or `accountLogin`/`server`/`platform` don’t match the key’s account. **429** = rate limit (60/min per key).

### 3.5 Trade journal (GET /api/trade-journal)

- **Query:** `page` (default 1), `limit` (default 20, max 100), and existing filters: `accountId`, `status`, `timeframe`, `pair`, `session`.
- **Response:** `{ "success": true, "count", "total", "page", "limit", "totalPages", "trades": [...] }`. Each trade includes:
  - **pips** — calculated from open/close (Buy: (close−open)/pipSize, Sell: (open−close)/pipSize). JPY pairs use pip size 0.01, others 0.0001.
  - **balanceAfter** — account balance after that closed trade (only when the account has a stored balance, e.g. from EA push with `balance`).
- Pagination: 20 records per page by default; use `?page=2` or `?limit=20&page=1`.

### 3.6 Other

- **GET /api/trading-account** — all accounts; EA accounts have `source: "ea"`. Do not call **POST /api/trading-account/:accountId/sync** for EA accounts (returns 400).
- Trades from the journal include `syncedFromEA: true` where applicable; deletion of EA-synced trades is blocked.

---

## 4. What the frontend must do

1. **Backend base URL**  
   Use `https://fxsnipserver-7uw7.onrender.com` (or your env, e.g. `VITE_API_URL`) for all API calls and for EA download links.

2. **Add EA account**  
   Form: account name, login, server, platform (mt4/mt5), optional broker. Submit **POST /api/trading-account/connect-ea**. On success, show the account and offer “Get API key” and “Download EA”.

3. **Get API key**  
   **GET /api/trading-account/:accountId/ea-api-key**. If response has `apiKey`, show it once with “Copy” and “This key won’t be shown again.” If only `key` is present, show key metadata and “Regenerate key”.

4. **Regenerate key**  
   **POST /api/trading-account/:accountId/ea-api-key/regenerate**. Show the new `apiKey` once and warn that the old key no longer works.

5. **Show base URL**  
   Display and optionally “Copy”: `https://fxsnipserver-7uw7.onrender.com` (user must enter this in the EA and allow it in MetaTrader WebRequest).

6. **Download EA**  
   Two links/buttons:
   - **Download for MT4** → `https://fxsnipserver-7uw7.onrender.com/ea/TradeJournalSync.mq4`
   - **Download for MT5** → `https://fxsnipserver-7uw7.onrender.com/ea/TradeJournalSync.mq5`  
   In code: `${baseUrl}/ea/TradeJournalSync.mq4` and `${baseUrl}/ea/TradeJournalSync.mq5`.

7. **Account list**  
   For accounts with `source === "ea"`, show “Synced via EA” and the EA actions (API key, regenerate, base URL, download EA, instructions). Do not show “Sync” for EA accounts.

8. **Trade journal**  
   Show trades with `syncedFromEA: true` (e.g. “Synced via EA”) and do not allow deleting them.

9. **User instructions** (modal or “How to connect”)  
   - Copy your **API key** and **Base URL** from this page.  
   - Download the EA for your platform (MT4 or MT5).  
   - In MetaTrader: **File → Open Data Folder** → **MQL4/Experts** (MT4) or **MQL5/Experts** (MT5) → paste the downloaded file.  
   - Restart MetaTrader or refresh Navigator. Right‑click the EA → **Modify** → **Allow WebRequest for listed URL** → add: `https://fxsnipserver-7uw7.onrender.com`  
   - Drag the EA onto a chart. In inputs: paste **API key** and **Base URL** → OK.  
   - **Save the chart (Ctrl+S)** so the API key and Base URL are stored with the chart (do not remove the EA from the chart).  
   - Trades will sync automatically to your journal.

---

## 5. Testing (backend deployed, UI local)

- Deploy backend to Render so it is live at `https://fxsnipserver-7uw7.onrender.com`.
- Run frontend locally with API base URL set to that (e.g. `VITE_API_URL=https://fxsnipserver-7uw7.onrender.com`).
- CORS already allows `http://localhost:5173`; add other dev ports in `server/app.js` if needed.
- Test: login → create EA account → get API key → copy key and base URL → download EA from the two links → optionally test push with Postman/curl and check journal for `syncedFromEA: true`.

---

## 6. EA source files

- **Location in repo:** `server/ea/`
- **Files:** `TradeJournalSync.mq4` (MT4), `TradeJournalSync.mq5` (MT5) — both are present in the repo and are served by the backend.
- **Served at:** `https://fxsnipserver-7uw7.onrender.com/ea/TradeJournalSync.mq4` and `.../ea/TradeJournalSync.mq5` (same base URL as API).
- **API key and Base URL:** Declared as normal `input string` variables in the EA so MetaTrader saves them with the chart. For the values to persist, the user must **save the chart (Ctrl+S)** after entering them and keep the EA on the chart.

Users do not run the EA in the browser; they download the file, install it in MetaTrader, allow WebRequest for the base URL, and enter the API key and base URL in the EA inputs.
