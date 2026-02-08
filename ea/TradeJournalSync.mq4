//+------------------------------------------------------------------+
//| TradeJournalSync.mq4                                              |
//| Syncs open and closed trades to the journal backend.               |
//| Add base URL to Tools -> Options -> Expert Advisors -> Allow WebRequest. |
//+------------------------------------------------------------------+
#property copyright "FxSnip"
#property link      ""
#property version   "1.00"
#property strict

input string InpApiKey     = "";           // API key (from journal app)
input string InpBaseUrl    = "https://fxsnipserver-7uw7.onrender.com"; // Base URL (no trailing slash)
input int    InpSyncSeconds= 60;           // Sync interval (seconds)
input int    InpHistoryDays= 7;           // Send closed trades from last N days

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
//| Expert deinitialization function                                  |
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
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02d.000Z",
      TimeYear(t), TimeMonth(t), TimeDay(t), TimeHour(t), TimeMinute(t), TimeSeconds(t));
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
string BuildTradeJson(int ticket, int type, string symbol, double openPrice, double closePrice,
   double volume, datetime openTime, datetime closeTime, double profit, double commission, double swap,
   double sl, double tp, string status)
{
   string typeStr = (type == OP_BUY) ? "buy" : "sell";
   string sym = JsonEscape(symbol);
   string openTimeStr = TimeToISO(openTime);
   string closeTimeStr = (closeTime > 0) ? ("\"" + TimeToISO(closeTime) + "\"") : "null";
   string closePriceStr = (closePrice != 0) ? DoubleToString(closePrice, 5) : "null";
   return StringFormat(
      "{\"ticket\":\"%d\",\"type\":\"%s\",\"pair\":\"%s\",\"openPrice\":%s,\"closePrice\":%s,\"volume\":%s,"
      "\"openTime\":\"%s\",\"closeTime\":%s,\"profit\":%s,\"commission\":%s,\"swap\":%s,"
      "\"stopLoss\":%s,\"takeProfit\":%s,\"status\":\"%s\"}",
      ticket, typeStr, sym, DoubleToString(openPrice, 5), closePriceStr, DoubleToString(volume, 2),
      openTimeStr, closeTimeStr, DoubleToString(profit, 2), DoubleToString(commission, 2), DoubleToString(swap, 2),
      (sl != 0) ? DoubleToString(sl, 5) : "null", (tp != 0) ? DoubleToString(tp, 5) : "null", status
   );
}

//+------------------------------------------------------------------+
//| Collect trades and send to backend                                 |
//+------------------------------------------------------------------+
void DoSync()
{
   string login   = IntegerToString(AccountNumber());
   string server  = AccountServer();
   string platform= "mt4";
   string trades  = "";

   // Open positions
   int total = OrdersTotal();
   for(int i = 0; i < total; i++)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_TRADES)) continue;
      if(OrderSymbol() == "") continue;
      if(OrderType() != OP_BUY && OrderType() != OP_SELL) continue;

      string one = BuildTradeJson(
         OrderTicket(), OrderType(), OrderSymbol(),
         OrderOpenPrice(), 0, OrderLots(), OrderOpenTime(), 0,
         OrderProfit() + OrderSwap() + OrderCommission(), OrderCommission(), OrderSwap(),
         OrderStopLoss(), OrderTakeProfit(), "open"
      );
      if(StringLen(trades) > 0) trades += ",";
      trades += one;
   }

   // Closed orders from history (last N days)
   datetime from = TimeCurrent() - InpHistoryDays * 24 * 3600;
   int histTotal = OrdersHistoryTotal();
   for(int i = histTotal - 1; i >= 0; i--)
   {
      if(!OrderSelect(i, SELECT_BY_POS, MODE_HISTORY)) continue;
      if(OrderCloseTime() == 0) continue;
      if(OrderOpenTime() < from) continue;
      if(OrderSymbol() == "") continue;
      if(OrderType() != OP_BUY && OrderType() != OP_SELL) continue;

      string one = BuildTradeJson(
         OrderTicket(), OrderType(), OrderSymbol(),
         OrderOpenPrice(), OrderClosePrice(), OrderLots(), OrderOpenTime(), OrderCloseTime(),
         OrderProfit() + OrderSwap() + OrderCommission(), OrderCommission(), OrderSwap(),
         OrderStopLoss(), OrderTakeProfit(), "closed"
      );
      if(StringLen(trades) > 0) trades += ",";
      trades += one;
   }

   if(StringLen(trades) == 0)
   {
      g_lastSync = TimeCurrent();
      return;
   }

   string body = "{\"platform\":\"" + platform + "\",\"accountLogin\":\"" + JsonEscape(login) +
      "\",\"server\":\"" + JsonEscape(server) + "\",\"trades\":[" + trades + "]}";

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
   for(int j = 0; j < bodyLen; j++)
      data[j] = (uchar)StringGetCharacter(body, j);

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
