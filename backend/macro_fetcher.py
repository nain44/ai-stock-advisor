import urllib.request
import json
from datetime import datetime, timedelta
import yfinance as yf

# Memory cache stores to protect against rate limits and keep response times fast
FOREX_CACHE = {}      # 1 hour expiration
COMMODITY_CACHE = {}  # 15 minutes expiration
INDEX_CACHE = {}      # 5 minutes expiration
MAX_INDEX_CACHE_SIZE = 100


def prune_index_cache(cache, limit):
    if len(cache) > limit:
        while len(cache) > limit:
            cache.pop(next(iter(cache)))

def get_macro_indicators(market: str = "PK", index_symbol: str = "^KSE", index_name: str = "KSE100"):
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
        forex_rates_dict = {"PKR": 278.4, "INR": 83.5, "EUR": 0.92, "GBP": 0.78, "JPY": 154.0, "AED": 3.67, "CAD": 1.37, "TRY": 33.5}
        
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
    elif market == "CA":
        forex_list = [
            {"pair": "USD/CAD", "rate": round(usd_cad, 3)},
            {"pair": "EUR/CAD", "rate": round(usd_cad / usd_eur, 3)},
            {"pair": "GBP/CAD", "rate": round(usd_cad / usd_gbp, 3)},
            {"pair": "CAD/USD", "rate": round(1.0 / usd_cad, 3)}
        ]
    elif market == "JP":
        forex_list = [
            {"pair": "USD/JPY", "rate": round(usd_jpy, 2)},
            {"pair": "EUR/JPY", "rate": round(usd_jpy / usd_eur, 2)},
            {"pair": "GBP/JPY", "rate": round(usd_jpy / usd_gbp, 2)},
            {"pair": "CAD/JPY", "rate": round(usd_jpy / usd_cad, 2)}
        ]
    elif market == "DE":
        forex_list = [
            {"pair": "EUR/USD", "rate": round(1.0 / usd_eur, 3)},
            {"pair": "GBP/EUR", "rate": round(usd_eur / usd_gbp, 3)},
            {"pair": "EUR/JPY", "rate": round(usd_jpy / usd_eur, 2)},
            {"pair": "EUR/CHF", "rate": round(forex_rates_dict.get("CHF", 0.90) / usd_eur, 3)}
        ]
    elif market == "AU":
        usd_aud = forex_rates_dict.get("AUD", 1.50)
        forex_list = [
            {"pair": "AUD/USD", "rate": round(1.0 / usd_aud, 3)},
            {"pair": "USD/AUD", "rate": round(usd_aud, 3)},
            {"pair": "EUR/AUD", "rate": round(usd_aud / usd_eur, 3)},
            {"pair": "GBP/AUD", "rate": round(usd_aud / usd_gbp, 3)}
        ]
    elif market == "SA":
        usd_sar = forex_rates_dict.get("SAR", 3.75)
        forex_list = [
            {"pair": "USD/SAR", "rate": round(usd_sar, 2)},
            {"pair": "EUR/SAR", "rate": round(usd_sar / usd_eur, 2)},
            {"pair": "GBP/SAR", "rate": round(usd_sar / usd_gbp, 2)},
            {"pair": "AED/SAR", "rate": round(usd_sar / usd_aed, 3)}
        ]
    elif market == "AE":
        forex_list = [
            {"pair": "USD/AED", "rate": round(usd_aed, 2)},
            {"pair": "EUR/AED", "rate": round(usd_aed / usd_eur, 2)},
            {"pair": "GBP/AED", "rate": round(usd_aed / usd_gbp, 2)},
            {"pair": "SAR/AED", "rate": round(usd_aed / forex_rates_dict.get("SAR", 3.75), 3)}
        ]
    elif market == "CN":
        usd_cny = forex_rates_dict.get("CNY", 7.25)
        forex_list = [
            {"pair": "USD/CNY", "rate": round(usd_cny, 3)},
            {"pair": "EUR/CNY", "rate": round(usd_cny / usd_eur, 3)},
            {"pair": "GBP/CNY", "rate": round(usd_cny / usd_gbp, 3)},
            {"pair": "CNY/HKD", "rate": round(forex_rates_dict.get("HKD", 7.80) / usd_cny, 3)}
        ]
    elif market == "QA":
        usd_qar = forex_rates_dict.get("QAR", 3.64)
        forex_list = [
            {"pair": "USD/QAR", "rate": round(usd_qar, 3)},
            {"pair": "EUR/QAR", "rate": round(usd_qar / usd_eur, 3)},
            {"pair": "GBP/QAR", "rate": round(usd_qar / usd_gbp, 3)},
            {"pair": "AED/QAR", "rate": round(usd_qar / usd_aed, 3)}
        ]
    elif market == "EG":
        usd_egp = forex_rates_dict.get("EGP", 48.5)
        forex_list = [
            {"pair": "USD/EGP", "rate": round(usd_egp, 2)},
            {"pair": "EUR/EGP", "rate": round(usd_egp / usd_eur, 2)},
            {"pair": "GBP/EGP", "rate": round(usd_egp / usd_gbp, 2)},
            {"pair": "SAR/EGP", "rate": round(usd_egp / forex_rates_dict.get("SAR", 3.75), 2)}
        ]
    elif market == "IR":
        usd_irr = forex_rates_dict.get("IRR", 42000.0)
        forex_list = [
            {"pair": "USD/IRR", "rate": round(usd_irr, 1)},
            {"pair": "EUR/IRR", "rate": round(usd_irr / usd_eur, 1)},
            {"pair": "GBP/IRR", "rate": round(usd_irr / usd_gbp, 1)},
            {"pair": "AED/IRR", "rate": round(usd_irr / usd_aed, 1)}
        ]
    elif market == "TR":
        usd_try = forex_rates_dict.get("TRY", 33.5)
        forex_list = [
            {"pair": "USD/TRY", "rate": round(usd_try, 2)},
            {"pair": "EUR/TRY", "rate": round(usd_try / usd_eur, 2)},
            {"pair": "GBP/TRY", "rate": round(usd_try / usd_gbp, 2)},
            {"pair": "AED/TRY", "rate": round(usd_try / usd_aed, 2)}
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
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_pkr * 1.018
                item["localized"] = {
                    "label": "Gold per Tola",
                    "price": f"Rs. {round(tola_price, -2):,.0f}"
                }
            elif name == "Silver":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_pkr * 1.018
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
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_inr * 1.015
                item["localized"] = {
                    "label": "Gold per Tola",
                    "price": f"₹{round(tola_price, -1):,.0f}"
                }
            elif name == "Silver":
                tola_price = (price_usd / 31.1034768) * 11.6638 * usd_inr * 1.015
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
                    "label": "Gold per Gram",
                    "price": f"£{round(g_price, 2):,.2f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_gbp
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"£{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_gbp
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"£{round(barrel_price, 2):,.2f}"
                }
        elif market == "CA":
            if name == "Gold":
                oz_price = price_usd * usd_cad
                item["localized"] = {
                    "label": "Gold per oz",
                    "price": f"C${round(oz_price, 2):,.2f}"
                }
            elif name == "Silver":
                oz_price = price_usd * usd_cad
                item["localized"] = {
                    "label": "Silver per oz",
                    "price": f"C${round(oz_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_cad
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"C${round(barrel_price, 2):,.2f}"
                }
        elif market == "JP":
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_jpy
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"¥{round(g_price, 0):,.0f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_jpy
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"¥{round(g_price, 1):,.1f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_jpy
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"¥{round(barrel_price, 0):,.0f}"
                }
        elif market == "DE":
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_eur
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"€{round(g_price, 2):,.2f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_eur
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"€{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_eur
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"€{round(barrel_price, 2):,.2f}"
                }
        elif market == "AU":
            usd_aud = forex_rates_dict.get("AUD", 1.50)
            if name == "Gold":
                oz_price = price_usd * usd_aud
                item["localized"] = {
                    "label": "Gold per oz",
                    "price": f"A${round(oz_price, 2):,.2f}"
                }
            elif name == "Silver":
                oz_price = price_usd * usd_aud
                item["localized"] = {
                    "label": "Silver per oz",
                    "price": f"A${round(oz_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_aud
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"A${round(barrel_price, 2):,.2f}"
                }
        elif market == "SA":
            usd_sar = forex_rates_dict.get("SAR", 3.75)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_sar
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"{round(g_price, 1):,.1f} SAR"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_sar
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"{round(g_price, 2):,.2f} SAR"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_sar
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"{round(barrel_price, 1):,.1f} SAR"
                }
        elif market == "AE":
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_aed
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"{round(g_price, 1):,.1f} AED"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_aed
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"{round(g_price, 2):,.2f} AED"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_aed
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"{round(barrel_price, 1):,.1f} AED"
                }
        elif market == "CN":
            usd_cny = forex_rates_dict.get("CNY", 7.25)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_cny
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"¥{round(g_price, 1):,.1f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_cny
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"¥{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_cny
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"¥{round(barrel_price, 1):,.1f}"
                }
        elif market == "QA":
            usd_qar = forex_rates_dict.get("QAR", 3.64)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_qar
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"{round(g_price, 1):,.1f} QAR"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_qar
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"{round(g_price, 2):,.2f} QAR"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_qar
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"{round(barrel_price, 1):,.1f} QAR"
                }
        elif market == "EG":
            usd_egp = forex_rates_dict.get("EGP", 48.5)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_egp
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"E£{round(g_price, 1):,.1f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_egp
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"E£{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_egp
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"E£{round(barrel_price, 1):,.1f}"
                }
        elif market == "IR":
            usd_irr = forex_rates_dict.get("IRR", 42000.0)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_irr
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"{round(g_price, 0):,.0f} IRR"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_irr
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"{round(g_price, 0):,.0f} IRR"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_irr
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"{round(barrel_price, 0):,.0f} IRR"
                }
        elif market == "TR":
            usd_try = forex_rates_dict.get("TRY", 33.5)
            if name == "Gold":
                g_price = (price_usd / 31.1034768) * usd_try
                item["localized"] = {
                    "label": "Gold per Gram",
                    "price": f"₺{round(g_price, 1):,.1f}"
                }
            elif name == "Silver":
                g_price = (price_usd / 31.1034768) * usd_try
                item["localized"] = {
                    "label": "Silver per Gram",
                    "price": f"₺{round(g_price, 2):,.2f}"
                }
            elif name == "Crude Oil":
                barrel_price = price_usd * usd_try
                item["localized"] = {
                    "label": "Crude Oil per bbl",
                    "price": f"₺{round(barrel_price, 1):,.1f}"
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

    # 4. Fetch live Index Quote (e.g. ^GSPC, ^KSE)
    index_data = None
    cache_key = f"{market}:{index_symbol}"
    if cache_key in INDEX_CACHE and now - INDEX_CACHE[cache_key]["time"] < timedelta(minutes=5):
        index_data = INDEX_CACHE[cache_key]["data"]
    else:
        try:
            t = yf.Ticker(index_symbol)
            hist = t.history(period="2d")
            if not hist.empty:
                current_price = float(hist["Close"].iloc[-1])
                prev_close = float(hist["Close"].iloc[-2]) if len(hist) > 1 else current_price
                change = float(current_price - prev_close)
                pct_change = float((change / prev_close) * 100) if prev_close != 0 else 0.0
                
                sign = "+" if change >= 0 else ""
                change_str = f"{sign}{change:,.2f} ({sign}{pct_change:.2f}%)"
                
                index_data = {
                    "name": index_name,
                    "symbol": index_symbol,
                    "val": f"{current_price:,.2f}",
                    "change": change_str,
                    "positive": bool(change >= 0)
                }
                INDEX_CACHE[cache_key] = {
                    "data": index_data,
                    "time": now
                }
                prune_index_cache(INDEX_CACHE, MAX_INDEX_CACHE_SIZE)
        except Exception as e:
            print(f"[macro_fetcher] Error loading index {index_symbol}: {e}")
            
    if not index_data:
        if cache_key in INDEX_CACHE:
            index_data = INDEX_CACHE[cache_key]["data"]
        else:
            fallback_vals = {
                "^GSPC": {"name": "S&P 500", "val": "5,459.10", "change": "+48.30 (+0.89%)", "positive": True},
                "^NSEI": {"name": "NIFTY 50", "val": "24,315.90", "change": "+102.50 (+0.42%)", "positive": True},
                "^FTSE": {"name": "FTSE 100", "val": "8,185.30", "change": "-24.10 (-0.29%)", "positive": False},
                "^KSE": {"name": "KSE100", "val": "171,021.00", "change": "-718.00 (-0.42%)", "positive": False}
            }
            fb = fallback_vals.get(index_symbol, {"name": index_name, "val": "0.00", "change": "0.00 (0.00%)", "positive": True})
            index_data = {
                "name": fb["name"],
                "symbol": index_symbol,
                "val": fb["val"],
                "change": fb["change"],
                "positive": fb["positive"]
            }

    return {
        "commodities": commodity_list,
        "forex": forex_list,
        "index": index_data,
        "timestamp": now.strftime("%I:%M %p")
    }
