//+------------------------------------------------------------------+
//| TradeJournalSync.mq5                                              |
//| Syncs open and closed trades to the journal backend.               |
//| Add base URL to Tools -> Options -> Expert Advisors -> Allow WebRequest. |
//+------------------------------------------------------------------+
#property copyright "FxSnip"
#property link      ""
#property version   "1.00"

// These are normal input variables so MetaTrader saves them with the chart.
// After entering the API key and Base URL, save the chart (Ctrl+S) so they persist.
input string InpApiKey     = "";           // API key (from journal app)
input string InpBaseUrl    = "https://fxsnipserver-7uw7.onrender.com"; // Base URL (no trailing slash)
input int    InpSyncSeconds= 60;           // Sync interval (seconds)
input int    InpHistoryDays= 180;          // Send closed trades from last N days (default 6 months)

string g_lastError = "";
datetime g_lastSync = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   if(StringLen(InpApiKey) < 10)
   {
      Print("TradeJournalSync: Please set your API key in EA inputs.");
      return(INIT_PARAMETERS_INCORRECT);
   }
   if(StringFind(InpBaseUrl, "http") != 0)
   {
      Print("TradeJournalSync: Base URL must start with https://");
      return(INIT_PARAMETERS_INCORRECT);
   }
   EventSetTimer((int)MathMax(1, InpSyncSeconds));
   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
}

//+------------------------------------------------------------------+
//| Timer: run sync                                                    |
//+------------------------------------------------------------------+
void OnTimer()
{
   DoSync();
}

//+------------------------------------------------------------------+
//| Format datetime to ISO 8601                                        |
//+------------------------------------------------------------------+
string TimeToISO(datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d.000Z", dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
//| Escape string for JSON                                             |
//+------------------------------------------------------------------+
string JsonEscape(string s)
{
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return s;
}

//+------------------------------------------------------------------+
//| Build one trade JSON object                                        |
//+------------------------------------------------------------------+
string BuildTradeJson(string ticket, string type, string symbol, double openPrice, double closePrice,
   double volume, datetime openTime, datetime closeTime, double profit, double commission, double swap,
   double sl, double tp, string status)
{
   string sym = JsonEscape(symbol);
   string openTimeStr = TimeToISO(openTime);
   string closeTimeStr = (closeTime > 0) ? ("\"" + TimeToISO(closeTime) + "\"") : "null";
   string closePriceStr = (closePrice != 0) ? DoubleToString(closePrice, 5) : "null";
   return StringFormat(
      "{\"ticket\":\"%s\",\"type\":\"%s\",\"pair\":\"%s\",\"openPrice\":%s,\"closePrice\":%s,\"volume\":%s,"
      "\"openTime\":\"%s\",\"closeTime\":%s,\"profit\":%s,\"commission\":%s,\"swap\":%s,"
      "\"stopLoss\":%s,\"takeProfit\":%s,\"status\":\"%s\"}",
      ticket, type, sym, DoubleToString(openPrice, 5), closePriceStr, DoubleToString(volume, 2),
      openTimeStr, closeTimeStr, DoubleToString(profit, 2), DoubleToString(commission, 2), DoubleToString(swap, 2),
      (sl != 0) ? DoubleToString(sl, 5) : "null", (tp != 0) ? DoubleToString(tp, 5) : "null", status
   );
}

//+------------------------------------------------------------------+
//| Collect trades and send to backend                                 |
//+------------------------------------------------------------------+
void DoSync()
{
   string login   = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
   string server  = AccountInfoString(ACCOUNT_SERVER);
   string platform= "mt5";
   string trades  = "";

   // Open positions
   int total = PositionsTotal();
   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0) continue;
      if(PositionGetString(POSITION_SYMBOL) == "") continue;
      long posType = PositionGetInteger(POSITION_TYPE);
      if(posType != POSITION_TYPE_BUY && posType != POSITION_TYPE_SELL) continue;

      string typeStr = (posType == POSITION_TYPE_BUY) ? "buy" : "sell";
      double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      string one = BuildTradeJson(
         IntegerToString(ticket), typeStr, PositionGetString(POSITION_SYMBOL),
         PositionGetDouble(POSITION_PRICE_OPEN), 0, PositionGetDouble(POSITION_VOLUME),
         (datetime)PositionGetInteger(POSITION_TIME), 0,
         profit, 0, PositionGetDouble(POSITION_SWAP),
         PositionGetDouble(POSITION_SL), PositionGetDouble(POSITION_TP), "open"
      );
      if(StringLen(trades) > 0) trades += ",";
      trades += one;
   }

   // Closed: history deals (OUT = close)
   datetime from = TimeCurrent() - InpHistoryDays * 24 * 3600;
   datetime to   = TimeCurrent() + 1;
   if(!HistorySelect(from, to)) return;
   int dealTotal = HistoryDealsTotal();
   for(int i = dealTotal - 1; i >= 0; i--)
   {
      ulong dealTicket = HistoryDealGetTicket(i);
      if(dealTicket == 0) continue;
      if(HistoryDealGetInteger(dealTicket, DEAL_ENTRY) != DEAL_ENTRY_OUT) continue;

      ulong posId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
      if(!HistorySelectByPosition(posId)) continue;

      double closePrice = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
      double volume    = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
      datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
      double profit   = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
      double swap     = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
      string symbol   = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      long dealType   = HistoryDealGetInteger(dealTicket, DEAL_TYPE);

      double openPrice = 0;
      datetime openTime = 0;
      double sl = 0, tp = 0;
      int inCount = HistoryDealsTotal();
      for(int j = 0; j < inCount; j++)
      {
         ulong d = HistoryDealGetTicket(j);
         if(d == 0) continue;
         if(HistoryDealGetInteger(d, DEAL_ENTRY) != DEAL_ENTRY_IN) continue;
         openPrice = HistoryDealGetDouble(d, DEAL_PRICE);
         openTime  = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
         break;
      }

      string typeStr = (dealType == DEAL_TYPE_BUY) ? "buy" : "sell";
      string one = BuildTradeJson(
         IntegerToString(posId), typeStr, symbol,
         openPrice, closePrice, volume, openTime, closeTime,
         profit, commission, swap, sl, tp, "closed"
      );
      if(StringLen(trades) > 0) trades += ",";
      trades += one;
      HistorySelect(from, to); // restore selection for next iteration
   }

   if(StringLen(trades) == 0)
   {
      g_lastSync = TimeCurrent();
      return;
   }

   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity  = AccountInfoDouble(ACCOUNT_EQUITY);
   string body = "{\"platform\":\"" + platform + "\",\"accountLogin\":\"" + JsonEscape(login) +
      "\",\"server\":\"" + JsonEscape(server) + "\",\"balance\":" + DoubleToString(balance, 2) +
      ",\"equity\":" + DoubleToString(equity, 2) + ",\"trades\":[" + trades + "]}";

   string url = InpBaseUrl;
   if(StringFind(url, "http") != 0) url = "https://" + url;
   StringTrimLeft(url);
   StringTrimRight(url);
   if(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url)-1) == '/')
      url = StringSubstr(url, 0, StringLen(url)-1);
   url += "/api/ea/push-trades";

   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpApiKey;

   uchar data[];
   int bodyLen = StringLen(body);
   ArrayResize(data, bodyLen);
   StringToCharArray(body, data, 0, bodyLen, CP_UTF8);

   char result[];
   string resultHeaders;
   int res = WebRequest("POST", url, headers, 5000, data, result, resultHeaders);

   if(res == -1)
   {
      int err = GetLastError();
      g_lastError = "WebRequest error " + IntegerToString(err) + ". Add URL to Expert Advisors -> Allow WebRequest: " + InpBaseUrl;
      Print("TradeJournalSync: ", g_lastError);
      return;
   }
   if(res >= 200 && res < 300)
   {
      g_lastSync = TimeCurrent();
      g_lastError = "";
      return;
   }
   g_lastError = "HTTP " + IntegerToString(res);
   Print("TradeJournalSync: ", g_lastError);
}

//+------------------------------------------------------------------+
