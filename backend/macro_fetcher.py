import urllib.request
import json
from datetime import datetime, timedelta
import yfinance as yf

# Memory cache stores to protect against rate limits and keep response times fast
FOREX_CACHE = {}      # 1 hour expiration
COMMODITY_CACHE = {}  # 15 minutes expiration

def get_macro_indicators(market: str = "PK"):
    """
    Fetches real-time commodity futures (Gold, Silver, WTI Crude Oil) and Forex currency pairs
    based on the selected tab market. Converts commodity gold rate into localized weight units (Tola/g).
    """
    market = (market or "PK").upper()
    now = datetime.now()
    
    # 1. Fetch Forex currency exchange rates (USD base = 1)
    forex_rates_dict = None
    if "data" in FOREX_CACHE and now - FOREX_CACHE["time"] < timedelta(hours=1):
        forex_rates_dict = FOREX_CACHE["data"]
    else:
        try:
            url = "https://open.er-api.com/v6/latest/USD"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as res:
                rates_data = json.loads(res.read().decode())
                if rates_data and "rates" in rates_data:
                    rates = rates_data["rates"]
                    FOREX_CACHE["data"] = rates
                    FOREX_CACHE["time"] = now
                    forex_rates_dict = rates
        except Exception as e:
            print(f"[macro_fetcher] Error loading exchange rates: {e}")
            # Fallback to expired cache if available
            forex_rates_dict = FOREX_CACHE.get("data")
            
    # Absolute local fallback in case network is down and cache is empty
    if not forex_rates_dict:
        forex_rates_dict = {"PKR": 278.4, "INR": 83.5, "EUR": 0.92, "GBP": 0.78, "JPY": 154.0, "AED": 3.67, "CAD": 1.37}
        
    usd_pkr = forex_rates_dict.get("PKR", 278.4)
    usd_inr = forex_rates_dict.get("INR", 83.5)
    usd_eur = forex_rates_dict.get("EUR", 0.92)
    usd_gbp = forex_rates_dict.get("GBP", 0.78)
    usd_jpy = forex_rates_dict.get("JPY", 154.0)
    usd_aed = forex_rates_dict.get("AED", 3.67)
    usd_cad = forex_rates_dict.get("CAD", 1.37)

    # Filter/calculate Forex pairs depending on the active tab context
    forex_list = []
    if market == "PK":
        forex_list = [
            {"pair": "USD/PKR", "rate": round(usd_pkr, 2)},
            {"pair": "GBP/PKR", "rate": round(usd_pkr / usd_gbp, 2)},
            {"pair": "EUR/PKR", "rate": round(usd_pkr / usd_eur, 2)},
            {"pair": "AED/PKR", "rate": round(usd_pkr / usd_aed, 2)}
        ]
    elif market == "IN":
        forex_list = [
            {"pair": "USD/INR", "rate": round(usd_inr, 2)},
            {"pair": "EUR/INR", "rate": round(usd_inr / usd_eur, 2)},
            {"pair": "GBP/INR", "rate": round(usd_inr / usd_gbp, 2)},
            {"pair": "AED/INR", "rate": round(usd_inr / usd_aed, 2)}
        ]
    elif market == "UK":
        forex_list = [
            {"pair": "GBP/USD", "rate": round(1.0 / usd_gbp, 3)},
            {"pair": "EUR/GBP", "rate": round(usd_gbp / usd_eur, 3)},
            {"pair": "USD/JPY", "rate": round(usd_jpy, 2)},
            {"pair": "GBP/EUR", "rate": round(usd_eur / usd_gbp, 3)}
        ]
    else: # US tab
        forex_list = [
            {"pair": "EUR/USD", "rate": round(1.0 / usd_eur, 3)},
            {"pair": "GBP/USD", "rate": round(1.0 / usd_gbp, 3)},
            {"pair": "USD/JPY", "rate": round(usd_jpy, 2)},
            {"pair": "USD/CAD", "rate": round(usd_cad, 3)}
        ]

    # 2. Fetch Commodity rates (Gold, Silver, WTI Crude Oil)
    commodity_list = []
    if "data" in COMMODITY_CACHE and now - COMMODITY_CACHE["time"] < timedelta(minutes=15):
        commodity_list = COMMODITY_CACHE["data"]
    else:
        tickers_map = {"Gold": "GC=F", "Silver": "SI=F", "Crude Oil": "CL=F"}
        commodity_list = []
        
        for name, ticker in tickers_map.items():
            try:
                t = yf.Ticker(ticker)
                hist = t.history(period="2d")
                if not hist.empty:
                    current_price = hist["Close"].iloc[-1]
                    prev_close = hist["Close"].iloc[-2] if len(hist) > 1 else current_price
                    change = current_price - prev_close
                    pct = (change / prev_close) * 100 if prev_close != 0 else 0.0
                    commodity_list.append({
                        "name": name,
                        "ticker": ticker,
                        "price": round(current_price, 2),
                        "change": round(change, 2),
                        "pct_change": round(pct, 2)
                    })
            except Exception as e:
                print(f"[macro_fetcher] Error loading commodity {name}: {e}")
                
        # Cache results if we fetched successfully
        if len(commodity_list) > 0:
            COMMODITY_CACHE["data"] = commodity_list
            COMMODITY_CACHE["time"] = now

    # Fallback commodities list in case yfinance is blocked or offline
    if not commodity_list:
        commodity_list = [
            {"name": "Gold", "ticker": "GC=F", "price": 2385.4, "change": 10.7, "pct_change": 0.45},
            {"name": "Silver", "ticker": "SI=F", "price": 27.8, "change": 0.15, "pct_change": 0.54},
            {"name": "Crude Oil", "ticker": "CL=F", "price": 78.4, "change": -0.85, "pct_change": -1.07}
        ]

    # 3. Add localized conversions for ALL commodities based on active market
    for item in commodity_list:
        name = item["name"]
        price_usd = item["price"]
        
        if market == "PK":
            if name == "Gold":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_pkr
                item["localized"] = {
                    "label": "Gold per Tola",
                    "price": f"Rs. {round(tola_price, -2):,.0f}"
                }
            elif name == "Silver":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_pkr
                item["localized"] = {
                    "label": "Silver per Tola",
                    "price": f"Rs. {round(tola_price, -1):,.0f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_pkr
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"Rs. {round(barrel_price, -2):,.0f}"
                }
        elif market == "IN":
            if name == "Gold":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_inr
                item["localized"] = {
                    "label": "Gold per Tola",
                    "price": f"₹{round(tola_price, -1):,.0f}"
                }
            elif name == "Silver":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_inr
                item["localized"] = {
                    "label": "Silver per Tola",
                    "price": f"₹{round(tola_price, -1):,.0f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_inr
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"₹{round(barrel_price, -1):,.0f}"
                }
        elif market == "UK":
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_gbp
                item["localized"] = {
                    "label": "Gold per gram",
                    "price": f"£{round(g_price, 2):,.2f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_gbp
                item["localized"] = {
                    "label": "Silver per gram",
                    "price": f"£{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_gbp
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"£{round(barrel_price, 2):,.2f}"
                }
        else: # US tab
            if name == "Gold":
                item["localized"] = {
                    "label": "Gold per oz",
                    "price": f"${price_usd:,.2f}"
                }
            elif name == "Silver":
                item["localized"] = {
                    "label": "Silver per oz",
                    "price": f"${price_usd:,.2f}"
                }
            elif name == "Crude Oil":
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"${price_usd:,.2f}"
                }

    return {
        "commodities": commodity_list,
        "forex": forex_list,
        "timestamp": now.strftime("%I:%M %p")
    }
