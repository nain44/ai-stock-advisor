import math
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import psxdata
import yfinance as yf

# A dictionary of actual PSX companies with realistic profiles and current stats (approximate real-world figures)
STOCK_PROFILES = {
    "MARI": {
        "name": "Mari Petroleum Company Limited",
        "sector": "Oil & Gas Exploration",
        "current_price": 710.0,
        "pe_ratio": 7.8,
        "roe": 44.5,
        "div_yield": 6.8,
        "debt_equity": 12.0,
        "pb_ratio": 2.4,
        "eps": 91.0,
        "volume_avg": 250000,
        "description": "Mari Petroleum is one of the largest gas exploration and production companies in Pakistan, operating the country's largest gas reservoir at Mari Field. Extremely robust cash flows, high operating margins, and strong government backing.",
        "recent_news": [
            {"title": "Mari Petroleum announces major gas discovery in Sindh", "sentiment": "bullish", "source": "PSX Announcement"},
            {"title": "Mari reports 24% growth in quarterly earnings, beats expectations", "sentiment": "bullish", "source": "Financial Times"},
            {"title": "International crude oil prices surge amid Middle East tensions, supportive for exploration firms", "sentiment": "bullish", "source": "Bloomberg"}
        ]
    },
    "SYS": {
        "name": "Systems Limited",
        "sector": "Technology (IT Services)",
        "current_price": 420.0,
        "pe_ratio": 21.5,
        "roe": 29.8,
        "div_yield": 1.6,
        "debt_equity": 5.4,
        "pb_ratio": 5.1,
        "eps": 19.5,
        "volume_avg": 850000,
        "description": "Systems Limited is Pakistan's premier IT exporter, providing software development, systems integration, and business process outsourcing. It is heavily exposed to USD earnings, making it a key beneficiary of PKR devaluation.",
        "recent_news": [
            {"title": "Systems Limited expands operations in Saudi Arabia and UAE markets", "sentiment": "bullish", "source": "Business Recorder"},
            {"title": "Global tech slowdown fears temporarily pressure export-oriented IT sectors", "sentiment": "bearish", "source": "Dawn News"},
            {"title": "Systems Ltd wins consecutive Asia's 200 Best Under A Billion award", "sentiment": "bullish", "source": "Forbes"}
        ]
    },
    "LUCK": {
        "name": "Lucky Cement Limited",
        "sector": "Cement",
        "current_price": 780.0,
        "pe_ratio": 5.9,
        "roe": 17.5,
        "div_yield": 3.2,
        "debt_equity": 22.0,
        "pb_ratio": 1.1,
        "eps": 132.2,
        "volume_avg": 400000,
        "description": "Lucky Cement is the largest cement manufacturer in Pakistan, with diversified interests in power generation, automobiles (KIA Lucky Motors), and mobile phone manufacturing. Highly efficient plants and strong pricing power.",
        "recent_news": [
            {"title": "Lucky Cement reports higher local sales despite construction slowdown", "sentiment": "bullish", "source": "PSX Announcement"},
            {"title": "Coal price correction in international market improves gross margins for cement manufacturers", "sentiment": "bullish", "source": "Capital Market Update"},
            {"title": "Monetary policy rate hike could impact leveraging costs for industrial sector expansion", "sentiment": "bearish", "source": "State Bank Circular"}
        ]
    },
    "ENGRO": {
        "name": "Engro Corporation Limited",
        "sector": "Conglomerates",
        "current_price": 315.0,
        "pe_ratio": 6.1,
        "roe": 21.4,
        "div_yield": 12.7,
        "debt_equity": 45.0,
        "pb_ratio": 1.3,
        "eps": 51.6,
        "volume_avg": 520000,
        "description": "Engro Corporation is one of Pakistan's largest conglomerates, with business holdings in fertilizers, petrochemicals (PVC), telecommunication infrastructure, food products, and energy. Renowned for consistent high dividend payouts.",
        "recent_news": [
            {"title": "Engro Corp announces bumper interim dividend of PKR 15 per share", "sentiment": "bullish", "source": "Corporate Disclosure"},
            {"title": "Petrochemical margins compress globally, impacting chemical subsidiary performance", "sentiment": "bearish", "source": "Reuters Report"},
            {"title": "Engro Polymer expansion project goes online on schedule", "sentiment": "bullish", "source": "Engineering News"}
        ]
    },
    "FFC": {
        "name": "Fauji Fertilizer Company Limited",
        "sector": "Fertilizer",
        "current_price": 142.0,
        "pe_ratio": 5.4,
        "roe": 36.2,
        "div_yield": 14.1,
        "debt_equity": 18.0,
        "pb_ratio": 2.1,
        "eps": 26.3,
        "volume_avg": 980000,
        "description": "FFC is the market leader in fertilizer manufacturing, producing the renowned 'Sona Urea' brand. Highly stable cash flows, inelastic product demand, and excellent dividend history make it a classic defensive stock.",
        "recent_news": [
            {"title": "Urea prices remain firm in domestic market amid high demand", "sentiment": "bullish", "source": "Agri News"},
            {"title": "FFC records highest ever quarterly urea production volume", "sentiment": "bullish", "source": "Production Update"},
            {"title": "Gas pricing policy revisions could increase input raw material cost for fertilizer industry", "sentiment": "bearish", "source": "Ministry of Energy Release"}
        ]
    },
    "UBL": {
        "name": "United Bank Limited",
        "sector": "Commercial Banks",
        "current_price": 185.0,
        "pe_ratio": 4.2,
        "roe": 26.5,
        "div_yield": 15.7,
        "debt_equity": 0.0,  # Banks leverage is high, but standard D/E is calculated differently
        "pb_ratio": 1.2,
        "eps": 44.0,
        "volume_avg": 1200000,
        "description": "UBL is one of Pakistan's largest commercial banks, with a massive deposit base and extensive domestic and international branch networks. Very high interest rate environment has significantly boosted bank net interest margins.",
        "recent_news": [
            {"title": "UBL declares quarterly payout, maintains position as top dividend payer in banking", "sentiment": "bullish", "source": "Quarterly Report"},
            {"title": "State Bank keeps policy rate unchanged at historic high, supporting bank yields", "sentiment": "bullish", "source": "SBP Monetary Policy"},
            {"title": "Advance-to-Deposit Ratio (ADR) tax continues to challenge high-lending banks", "sentiment": "bearish", "source": "Tax Authority Circular"}
        ]
    },
    "EFERT": {
        "name": "Engro Fertilizers Limited",
        "sector": "Fertilizer",
        "current_price": 135.0,
        "pe_ratio": 5.8,
        "roe": 41.2,
        "div_yield": 14.8,
        "debt_equity": 28.0,
        "pb_ratio": 2.5,
        "eps": 23.2,
        "volume_avg": 1100000,
        "description": "Engro Fertilizers is a major player in the agricultural sector, manufacturing urea, DAP, and specialized fertilizer blends. Beneficiary of modernized plants (EnVen) with highly efficient fuel-gas consumption rates.",
        "recent_news": [
            {"title": "Engro Fertilizers launches new eco-friendly fertilizer variants", "sentiment": "bullish", "source": "Product Launch"},
            {"title": "Interim payout outperforms consensus analyst forecasts", "sentiment": "bullish", "source": "Brokerage Note"},
            {"title": "Fittings upgrade shutdown at main plant completed successfully ahead of time", "sentiment": "bullish", "source": "Operations Update"}
        ]
    },
    "PSO": {
        "name": "Pakistan State Oil Company Limited",
        "sector": "Oil & Gas Marketing",
        "current_price": 178.0,
        "pe_ratio": 5.2,
        "roe": 14.2,
        "div_yield": 5.6,
        "debt_equity": 68.0,
        "pb_ratio": 0.5,
        "eps": 34.2,
        "volume_avg": 750000,
        "description": "PSO is the state-owned oil marketing giant, holding the largest market share in retail fuels and lubricants. Highly sensitive to circular debt challenges, but owns massive infrastructure assets.",
        "recent_news": [
            {"title": "PSO circular debt resolution package under discussion at IMF review talks", "sentiment": "bullish", "source": "Finance Division Update"},
            {"title": "Petroleum product sales volume increases by 8% month-on-month", "sentiment": "bullish", "source": "Industry Statistics"},
            {"title": "Volatile exchange rate impacts inventory gains/losses for oil marketers", "sentiment": "bearish", "source": "Analytical report"}
        ]
    },
    "DGKC": {
        "name": "D.G. Khan Cement Company Limited",
        "sector": "Cement",
        "current_price": 72.5,
        "pe_ratio": 12.4,
        "roe": 5.2,
        "div_yield": 2.1,
        "debt_equity": 58.0,
        "pb_ratio": 0.4,
        "eps": 5.8,
        "volume_avg": 1800000,
        "description": "DGKC is a leading cement manufacturer with modern plants, including a waste-heat recovery system. Highly leveraged, making it vulnerable to high interest rates, and facing slow domestic construction activity.",
        "recent_news": [
            {"title": "DGKC exports cement shipments to USA market, boosting foreign exchange", "sentiment": "bullish", "source": "Export Desk"},
            {"title": "High interest rates increase finance costs, compressing net margins", "sentiment": "bearish", "source": "Financial Statement"},
            {"title": "Domestic cement dispatch numbers fall by 5% year-on-year", "sentiment": "bearish", "source": "APCMA Data"}
        ]
    },
    "HBL": {
        "name": "Habib Bank Limited",
        "sector": "Commercial Banks",
        "current_price": 115.0,
        "pe_ratio": 4.8,
        "roe": 19.8,
        "div_yield": 8.7,
        "debt_equity": 0.0,
        "pb_ratio": 0.7,
        "eps": 24.0,
        "volume_avg": 1300000,
        "description": "HBL is the largest commercial bank in Pakistan by asset size. It has a massive branch network and represents a major pillar of Pakistan's banking infrastructure, but has experienced higher provision expenses and capital adequacy challenges in international branches.",
        "recent_news": [
            {"title": "HBL digital banking transactions reach landmark volume milestone", "sentiment": "bullish", "source": "PR News"},
            {"title": "State Bank audit highlights need for increased provisioning on specific loan books", "sentiment": "bearish", "source": "SBP Report"},
            {"title": "Bank focuses on agricultural lending programs to boost domestic economic growth", "sentiment": "neutral", "source": "Dawn News"}
        ]
    },
    "MEBL": {
        "name": "Meezan Bank Limited",
        "sector": "Commercial Banks",
        "current_price": 220.0,
        "pe_ratio": 6.2,
        "roe": 48.2,
        "div_yield": 7.4,
        "debt_equity": 0.0,
        "pb_ratio": 2.1,
        "eps": 35.5,
        "volume_avg": 1500000,
        "description": "Meezan Bank is the first and largest Islamic commercial bank in Pakistan. It is a pioneer in Shariah-compliant retail and corporate banking, demonstrating exceptional growth and high returns on equity.",
        "recent_news": [
            {"title": "Meezan Bank profits surge by 45% on strong financing book growth", "sentiment": "bullish", "source": "Financial Statement"},
            {"title": "State Bank of Pakistan commends Meezan Bank's financial inclusion strides", "sentiment": "bullish", "source": "SBP Review"},
            {"title": "Islamic banking asset share grows to historic highs in Pakistan", "sentiment": "bullish", "source": "Industry Update"}
        ]
    },
    "HUBC": {
        "name": "The Hub Power Company Limited",
        "sector": "Power Generation",
        "current_price": 120.0,
        "pe_ratio": 4.8,
        "roe": 32.1,
        "div_yield": 14.5,
        "debt_equity": 42.0,
        "pb_ratio": 1.5,
        "eps": 25.0,
        "volume_avg": 2500000,
        "description": "Hubco is the largest independent power producer (IPP) in Pakistan, with a combined power generation capacity of over 3,000 MW. It has diversified holdings in coal mines, telecom infrastructure, and water desalination.",
        "recent_news": [
            {"title": "Hubco announces joint venture for regional electric vehicle assembly", "sentiment": "bullish", "source": "Corporate Disclosure"},
            {"title": "IPP circular debt receivables increase, posing minor working capital challenges", "sentiment": "bearish", "source": "Energy Analyst Report"},
            {"title": "Hubco declares interim dividend of Rs. 5 per share", "sentiment": "bullish", "source": "PSX Filing"}
        ]
    },
    "OGDC": {
        "name": "Oil & Gas Development Company Limited",
        "sector": "Oil & Gas Exploration",
        "current_price": 140.0,
        "pe_ratio": 3.8,
        "roe": 22.4,
        "div_yield": 8.2,
        "debt_equity": 8.0,
        "pb_ratio": 0.6,
        "eps": 36.8,
        "volume_avg": 2200000,
        "description": "OGDCL is the national oil and gas exploration company of Pakistan, holding the largest portfolio of hydrocarbon reserves and acreage. Strong state backing but exposed to circular debt receivables from utility buyers.",
        "recent_news": [
            {"title": "OGDCL begins production at newly discovered oil well in Kohlu", "sentiment": "bullish", "source": "Operational Update"},
            {"title": "Government works on major plan to settle gas sector circular debt, positive for OGDCL receivables", "sentiment": "bullish", "source": "Ministry of Finance"},
            {"title": "International crude price fluctuations impact inventory margins", "sentiment": "neutral", "source": "Bloomberg"}
        ]
    }
}

def get_available_stocks():
    """Returns a list of all stocks available with their metadata."""
    return [{"ticker": symbol, "name": info["name"], "sector": info["sector"]} for symbol, info in STOCK_PROFILES.items()]

def get_stock_profile(ticker: str):
    """Returns stock profile if exists, else None."""
    ticker = ticker.upper()
    return STOCK_PROFILES.get(ticker)

def _generate_simulated_historical_data(ticker: str, days: int = 120) -> pd.DataFrame:
    """
    Generates realistic historical price data (OHLCV) for a given stock ticker.
    Maintains characteristics of the stock, including base price and typical volatility.
    """
    ticker = ticker.upper()
    profile = get_stock_profile(ticker)
    if not profile:
        profile = {
            "name": f"Mock {ticker}",
            "current_price": 100.0,
            "volume_avg": 100000
        }
        
    base_price = profile["current_price"]
    avg_vol = profile["volume_avg"]
    
    # We want to build a realistic random walk back in time
    # Seed with ticker hash for reproducibility
    seed_val = sum(ord(c) for c in ticker)
    random.seed(seed_val)
    np.random.seed(seed_val)
    
    # Define drift and volatility based on company health
    # MARI, SYS, UBL have positive drift. DGKC has neutral/negative drift.
    drift = 0.0003
    volatility = 0.015
    if ticker in ["MARI", "SYS", "UBL", "FFC"]:
        drift = 0.0008
        volatility = 0.012
    elif ticker in ["DGKC", "HBL"]:
        drift = -0.0002
        volatility = 0.018
        
    prices = [base_price]
    # Generate prices going backward
    for _ in range(days - 1):
        # geometric brownian motion step (backward in time, so we reverse drift)
        change = np.random.normal(-drift, volatility)
        prev_price = prices[-1] * math.exp(change)
        prices.append(max(prev_price, 1.0))
        
    # Reverse to make chronological
    prices.reverse()
    
    # Generate OHLCV details
    data = []
    start_date = datetime.now() - timedelta(days=days)
    
    for i, price in enumerate(prices):
        current_date = start_date + timedelta(days=i)
        
        # Skip weekends for realistic trading calendar
        if current_date.weekday() >= 5:
            continue
            
        # Daily volatility around the closing price
        daily_vol = price * (volatility * random.uniform(0.6, 1.4))
        
        close = price
        high = price + (daily_vol * random.uniform(0.1, 0.8))
        low = price - (daily_vol * random.uniform(0.1, 0.8))
        open_val = price + (daily_vol * random.uniform(-0.4, 0.4))
        
        # Ensure high/low bound open/close
        high = max(high, open_val, close)
        low = min(low, open_val, close)
        
        # Volume with random fluctuations around average
        volume = int(avg_vol * random.uniform(0.4, 2.2))
        
        data.append({
            "Date": current_date.strftime("%Y-%m-%d"),
            "Open": round(open_val, 2),
            "High": round(high, 2),
            "Low": round(low, 2),
            "Close": round(close, 2),
            "Volume": volume
        })
        
    df = pd.DataFrame(data)
    return df

def get_yahoo_historical(ticker: str, days: int) -> pd.DataFrame:
    """
    Downloads historical data from Yahoo Finance and formats it to standard columns.
    """
    ticker = ticker.upper()
    try:
        # Calculate interval period
        period = "3mo"
        if days > 700:
            period = "5y"
        elif days > 350:
            period = "2y"
        elif days > 150:
            period = "1y"
        elif days > 50:
            period = "6mo"
        elif days > 10:
            period = "1mo"
        else:
            period = "5d"
            
        t = yf.Ticker(ticker)
        df = t.history(period=period)
        if df.empty:
            return pd.DataFrame()
            
        df = df.reset_index()
        df = df.rename(columns={
            "Open": "Open",
            "High": "High",
            "Low": "Low",
            "Close": "Close",
            "Volume": "Volume"
        })
        df["Date"] = df["Date"].apply(lambda d: d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d))
        df = df.sort_values(by="Date").reset_index(drop=True)
        return df[["Date", "Open", "High", "Low", "Close", "Volume"]].tail(days)
    except Exception as e:
        print(f"Error fetching Yahoo historical data for {ticker}: {e}")
        return pd.DataFrame()

def get_yahoo_quote(ticker: str) -> dict:
    """
    Queries Yahoo Finance and maps key metrics to our standardized quote dictionary.
    """
    ticker = ticker.upper()
    try:
        t = yf.Ticker(ticker)
        info = t.info
        if not info or not info.get("symbol"):
            return None
            
        price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("previousClose") or 0.0
        prev_close = info.get("previousClose") or price
        change = round(price - prev_close, 2)
        pct_change = (change / prev_close) * 100 if prev_close > 0 else 0.0
        pct_change_str = f"{round(pct_change, 2)}%"
        
        news_items = []
        raw_news = t.news or []
        for item in raw_news[:3]:
            content = item.get("content", {})
            title = content.get("title", "")
            provider = content.get("provider", {}).get("displayName", "Yahoo Finance")
            title_lower = title.lower()
            bullish_keywords = [
                "up", "rise", "surge", "gain", "growth", "jump", "higher", "beat", 
                "bullish", "profit", "dividend", "acquisition", "acquire", "record", 
                "climb", "high", "upgrade", "outperform", "buy", "success", "approval", 
                "expand", "expansion", "positive", "strong", "win", "exceed", "soar", 
                "rally", "rebound"
            ]
            bearish_keywords = [
                "down", "fall", "plummet", "loss", "drop", "lower", "miss", "bearish", 
                "decline", "slump", "warning", "warn", "debt", "shrink", "contract", 
                "cut", "downgrade", "underperform", "sell", "fail", "lawsuit", 
                "regulatory", "pressure", "weak", "plunge", "slashed", "negative"
            ]
            
            if any(w in title_lower for w in bullish_keywords):
                sentiment = "bullish"
            elif any(w in title_lower for w in bearish_keywords):
                sentiment = "bearish"
            else:
                sentiment = "neutral"
            news_items.append({
                "title": title,
                "sentiment": sentiment,
                "source": provider
            })
            
        sector = info.get("sectorDisp") or info.get("sector") or "US Equity"
        
        return {
            "ticker": ticker,
            "name": info.get("longName") or info.get("shortName") or ticker,
            "sector": sector,
            "price": round(price, 2),
            "change": change,
            "pct_change": pct_change_str,
            "is_up": change >= 0,
            "volume": int(info.get("volume") or info.get("regularMarketVolume") or 0),
            "high": round(info.get("dayHigh") or price, 2),
            "low": round(info.get("dayLow") or price, 2),
            "ldcp": round(prev_close, 2),
            "pe": round(info.get("trailingPE"), 2) if info.get("trailingPE") else 0.0,
            "pb_ratio": round(info.get("priceToBook"), 2) if info.get("priceToBook") else 1.0,
            "debt_equity": round(info.get("debtToEquity"), 2) if info.get("debtToEquity") else 0.0,
            "roe": round((info.get("returnOnEquity") or 0.0) * 100, 2),
            "div_yield": round((info.get("dividendYield") or 0.0) * 100, 2),
            "description": info.get("longBusinessSummary", "A listed stock on the US exchange."),
            "eps": round(info.get("trailingEps") or 0.0, 2),
            "news": news_items,
            "timestamp": datetime.now().strftime("%I:%M:%S %p")
        }
    except Exception as e:
        print(f"Error fetching Yahoo quote for {ticker}: {e}")
        return None

def generate_historical_data(ticker: str, days: int = 120, market: str = "PK") -> pd.DataFrame:
    """
    Fetches actual historical daily OHLCV data directly from the Pakistan Stock Exchange using psxdata,
    or from Yahoo Finance for US stocks.
    Falls back to simulation if the fetch fails.
    """
    ticker = ticker.upper()
    market_upper = market.upper()
    if market_upper in ["US", "IN", "UK"]:
        if market_upper == "IN" and not ticker.endswith(".NS"):
            ticker = f"{ticker}.NS"
        elif market_upper == "UK" and not ticker.endswith(".L"):
            ticker = f"{ticker}.L"
            
        df = get_yahoo_historical(ticker, days)
        if not df.empty:
            return df
        return _generate_simulated_historical_data(ticker, days)
        
    try:
        # Calculate start date going back `days` calendar days
        start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Download history
        df = psxdata.stocks(ticker, start=start_date)
        
        if df.empty:
            print(f"psxdata returned empty history for {ticker}. Falling back to simulation.")
            return _generate_simulated_historical_data(ticker, days)
            
        # Standardize columns: rename close to Close, open to Open, etc.
        df = df.rename(columns={
            "date": "Date",
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "volume": "Volume"
        })
        
        # Sort chronologically (oldest to newest)
        df = df.sort_values(by="Date").reset_index(drop=True)
        
        # Return standard columns
        return df[["Date", "Open", "High", "Low", "Close", "Volume"]]
    except Exception as e:
        print(f"Error fetching historical data for {ticker} from psxdata: {e}. Falling back to simulation.")
        return _generate_simulated_historical_data(ticker, days)


QUOTE_CACHE = {}
CACHE_DURATION = timedelta(minutes=2)


def _generate_simulated_quote(ticker: str):
    """
    Simulates a live quote with minor real-time fluctuations
    """
    ticker = ticker.upper()
    profile = get_stock_profile(ticker)
    if not profile:
        return None
        
    price = profile["current_price"]
    # Add a small random intraday change
    random.seed() # true randomness for live refresh
    pct_change = random.uniform(-0.015, 0.02)
    new_price = round(price * (1 + pct_change), 2)
    change = round(new_price - price, 2)
    pct_change_str = f"{round(pct_change * 100, 2)}%"
    
    return {
        "ticker": ticker,
        "name": profile["name"],
        "price": new_price,
        "change": change,
        "pct_change": pct_change_str,
        "is_up": change >= 0,
        "volume": int(profile["volume_avg"] * random.uniform(0.8, 1.5)),
        "high": round(new_price * 1.01, 2),
        "low": round(new_price * 0.99, 2),
        "ldcp": round(price, 2),
        "pe": profile["pe_ratio"],
        "roe": profile["roe"],
        "div_yield": profile["div_yield"],
        "news": profile["recent_news"],
        "timestamp": datetime.now().strftime("%I:%M:%S %p")
    }


def get_latest_quote(ticker: str, market: str = "PK"):
    """
    Fetches real-time price and statistics directly from the Pakistan Stock Exchange or Yahoo Finance for US.
    Falls back to simulation if the fetch fails.
    """
    ticker = ticker.upper()
    market_upper = market.upper()
    if market_upper == "IN" and not ticker.endswith(".NS"):
        ticker = f"{ticker}.NS"
    elif market_upper == "UK" and not ticker.endswith(".L"):
        ticker = f"{ticker}.L"
        
    now = datetime.now()
    cache_key = f"{market_upper}:{ticker}"
    
    # Check cache
    if cache_key in QUOTE_CACHE:
        cache_time, cached_data = QUOTE_CACHE[cache_key]
        if now - cache_time < CACHE_DURATION:
            return cached_data
            
    if market_upper in ["US", "IN", "UK"]:
        quote = get_yahoo_quote(ticker)
        if quote:
            QUOTE_CACHE[cache_key] = (now, quote)
            return quote
        # If Yahoo quote lookup fails entirely, fall back to mock US quote
        # We can construct a mock US profile dynamically if not found
        mock_profile = {
            "name": f"{ticker} Inc.",
            "sector": "US Equity",
            "current_price": 150.0,
            "pe_ratio": 25.0,
            "roe": 15.0,
            "div_yield": 1.2,
            "debt_equity": 30.0,
            "pb_ratio": 3.0,
            "eps": 6.0,
            "volume_avg": 1000000,
            "description": f"Standard US public equity: {ticker}",
            "recent_news": []
        }
        mock_quote = {
            "ticker": ticker,
            "name": mock_profile["name"],
            "price": 150.0,
            "change": 0.0,
            "pct_change": "0.0%",
            "is_up": True,
            "volume": 1000000,
            "high": 152.0,
            "low": 148.0,
            "ldcp": 150.0,
            "pe": 25.0,
            "roe": 15.0,
            "div_yield": 1.2,
            "news": [],
            "timestamp": now.strftime("%I:%M:%S %p")
        }
        return mock_quote
            
    try:
        df = psxdata.quote(ticker)
        if df.empty:
            print(f"psxdata returned empty quote for {ticker}. Falling back to simulation.")
            return _generate_simulated_quote(ticker)
            
        row = df.iloc[0]
        
        # Retrieve stats
        current_price = float(row.get("price", 0.0))
        pct_change = float(row.get("change_pct", 0.0))
        
        # Calculate change amount and previous close
        prev_close = current_price / (1 + (pct_change / 100.0)) if pct_change != -100 else current_price
        change = round(current_price - prev_close, 2)
        pct_change_str = f"{round(pct_change, 2)}%"
        
        # Fetch sector name and info from static profiles
        profile = get_stock_profile(ticker) or {
            "name": ticker,
            "sector": str(row.get("sector", "Unknown")),
            "pe_ratio": float(row.get("pe_ratio", 0.0)) if pd.notna(row.get("pe_ratio")) else 0.0,
            "roe": 0.0,
            "div_yield": float(row.get("dividend_yield", 0.0)) if pd.notna(row.get("dividend_yield")) else 0.0,
            "recent_news": []
        }
        
        volume = float(row.get("volume_avg_30d", 0)) if pd.notna(row.get("volume_avg_30d")) else float(profile.get("volume_avg", 0))
        pe = float(row.get("pe_ratio", 0.0)) if pd.notna(row.get("pe_ratio")) else float(profile.get("pe_ratio", 0.0))
        div_yield = float(row.get("dividend_yield", 0.0)) if pd.notna(row.get("dividend_yield")) else float(profile.get("div_yield", 0.0))
        roe = float(profile.get("roe", 0.0))
        
        # Extrapolate High and Low from simulated current price bounds
        high = round(current_price * 1.01, 2)
        low = round(current_price * 0.99, 2)
        ldcp = round(prev_close, 2)
        
        result = {
            "ticker": ticker,
            "name": profile.get("name", ticker),
            "sector": profile.get("sector", "Unknown"),
            "price": round(current_price, 2),
            "change": change,
            "pct_change": pct_change_str,
            "is_up": change >= 0,
            "volume": int(volume),
            "high": round(high, 2),
            "low": round(low, 2),
            "ldcp": round(ldcp, 2),
            "pe": round(pe, 2) if pe else 0.0,
            "roe": round(roe, 2) if roe else 0.0,
            "div_yield": round(div_yield, 2) if div_yield else 0.0,
            "news": profile.get("recent_news", []),
            "timestamp": datetime.now().strftime("%I:%M:%S %p")
        }
        
        QUOTE_CACHE[ticker] = (now, result)
        return result
    except Exception as e:
        print(f"Error fetching latest quote for {ticker} from psxdata: {e}. Falling back to simulation.")
        return _generate_simulated_quote(ticker)
