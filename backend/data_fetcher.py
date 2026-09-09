import math
import os
import random
from datetime import datetime, timedelta, timezone
import pandas as pd
import numpy as np

# NOTE: This module intentionally does NOT fetch or redistribute real
# exchange market data (e.g. via psxdata/yfinance live quotes). PSX's
# published data-licensing notice prohibits dissemination of its market
# data feed (prices, bids/asks, volumes, index levels) through
# applications without a license. All prices/volumes below are
# synthetically generated for demonstration purposes only.

# Baseline profiles used only as seeds for the simulation engine below —
# not live/real market data.
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


def get_pk_symbol_index():
    """Returns the static list of PK ticker/name/sector dicts used for search/autocomplete."""
    return get_available_stocks()

def get_stock_profile(ticker: str):
    """Returns stock profile if exists, else None."""
    ticker = ticker.upper()
    return STOCK_PROFILES.get(ticker)


def _get_or_create_mock_profile(ticker: str, market: str = "PK") -> dict:
    """
    Returns a profile for the simulation engine to seed a price series from.
    Uses the curated STOCK_PROFILES for known PK tickers; otherwise derives a
    deterministic (ticker-seeded, so stable across calls) placeholder profile
    for any other ticker/market. None of this reflects real market values.
    """
    ticker = ticker.upper()
    profile = get_stock_profile(ticker)
    if profile:
        return profile

    seed_val = sum(ord(c) for c in f"{market.upper()}:{ticker}")
    rng = random.Random(seed_val)
    base_price = round(rng.uniform(20, 500), 2)
    return {
        "name": f"{ticker} ({market.upper()})",
        "sector": f"{market.upper()} Equity (Simulated)",
        "current_price": base_price,
        "pe_ratio": round(rng.uniform(6, 30), 1),
        "roe": round(rng.uniform(5, 35), 1),
        "div_yield": round(rng.uniform(0, 6), 1),
        "debt_equity": round(rng.uniform(0, 80), 1),
        "pb_ratio": round(rng.uniform(0.8, 6), 1),
        "eps": round(base_price / rng.uniform(6, 30), 2),
        "volume_avg": int(rng.uniform(50000, 1000000)),
        "description": "Simulated equity for demonstration purposes only — not real market data.",
        "recent_news": []
    }


def _generate_simulated_historical_data(ticker: str, days: int = 120, market: str = "PK") -> pd.DataFrame:
    """
    Generates simulated historical price data (OHLCV) for a given stock ticker.
    Maintains characteristics of the stock, including base price and typical volatility.
    This is synthetic data for demonstration only, not real exchange data.
    """
    ticker = ticker.upper()
    profile = _get_or_create_mock_profile(ticker, market)

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


def generate_historical_data(ticker: str, days: int = 120, market: str = "PK") -> pd.DataFrame:
    """
    Returns simulated historical daily OHLCV candles for a ticker. This app
    does not fetch or redistribute real exchange data (see PSX's market
    data licensing notice) — values are synthetically generated.
    """
    return _generate_simulated_historical_data(ticker.upper(), days, market.upper())


QUOTE_CACHE = {}
CACHE_DURATION = timedelta(minutes=2)
MAX_QUOTE_CACHE_SIZE = 300
MAX_MARKET_NEWS_CACHE_SIZE = 50
MAX_TICKER_NEWS_CACHE_SIZE = 200


def prune_cache(cache, limit):
    if len(cache) > limit:
        while len(cache) > limit:
            cache.pop(next(iter(cache)))


def _generate_simulated_quote(ticker: str, market: str = "PK"):
    """
    Generates a simulated quote with minor random intraday-style fluctuations.
    This is synthetic data for demonstration only, not a real market feed.
    """
    ticker = ticker.upper()
    profile = _get_or_create_mock_profile(ticker, market)

    price = profile["current_price"]
    random.seed()  # fresh randomness on every call so the "market" feels alive
    pct_change = random.uniform(-0.015, 0.02)
    new_price = round(price * (1 + pct_change), 2)
    change = round(new_price - price, 2)
    pct_change_str = f"{round(pct_change * 100, 2)}%"

    return {
        "ticker": ticker,
        "name": profile["name"],
        "sector": profile.get("sector", "Simulated Equity"),
        "price": new_price,
        "change": change,
        "pct_change": pct_change_str,
        "is_up": change >= 0,
        "volume": int(profile["volume_avg"] * random.uniform(0.8, 1.5)),
        "high": round(new_price * 1.01, 2),
        "low": round(new_price * 0.99, 2),
        "ldcp": round(price, 2),
        "pe": profile.get("pe_ratio", 0.0),
        "roe": profile.get("roe", 0.0),
        "div_yield": profile.get("div_yield", 0.0),
        "pb_ratio": profile.get("pb_ratio", 1.0),
        "debt_equity": profile.get("debt_equity", 0.0),
        "eps": profile.get("eps", 0.0),
        "description": profile.get("description", "Simulated equity for demonstration purposes only."),
        "news": profile.get("recent_news", []),
        "timestamp": datetime.now().strftime("%I:%M:%S %p"),
        "source": "simulated",
        "is_live": False,
        "price_date": None,
    }


def get_latest_quote(ticker: str, market: str = "PK"):
    """
    Returns a simulated quote for the given ticker/market. This app does not
    fetch or redistribute real exchange market data (see PSX's market data
    licensing notice, which prohibits unlicensed dissemination of prices,
    volumes and index levels) — all values here are synthetically generated
    for demonstration purposes only.
    """
    ticker = ticker.upper()
    market_upper = market.upper()

    now = datetime.now()
    cache_key = f"{market_upper}:{ticker}"

    if cache_key in QUOTE_CACHE:
        cache_time, cached_data = QUOTE_CACHE[cache_key]
        if now - cache_time < CACHE_DURATION:
            return cached_data
    else:
        prune_cache(QUOTE_CACHE, MAX_QUOTE_CACHE_SIZE)

    quote = _generate_simulated_quote(ticker, market_upper)
    QUOTE_CACHE[cache_key] = (now, quote)
    prune_cache(QUOTE_CACHE, MAX_QUOTE_CACHE_SIZE)
    return quote


MARKET_NEWS_CACHE = {}
TICKER_NEWS_CACHE = {}

def fetch_market_news(market: str = "PK") -> list:
    """
    Fetches market-wide recent financial news from a live RSS feed.
    """
    import httpx
    import xml.etree.ElementTree as ET
    from urllib.parse import quote
    from datetime import datetime, timedelta

    market_upper = (market or "PK").upper()
    now = datetime.now(timezone.utc)

    fallback_news = [
        {
            "title": f"{market_upper} markets are moving on earnings, policy, and macroeconomic developments.",
            "link": "#",
            "pub_date": now.strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "source": "Market Pulse",
            "sentiment": "neutral"
        },
        {
            "title": f"Traders are watching {market_upper} sentiment closely as new data and headlines shape the session.",
            "link": "#",
            "pub_date": now.strftime("%a, %d %b %Y %H:%M:%S GMT"),
            "source": "Market Pulse",
            "sentiment": "bullish"
        }
    ]

    # Check cache (2 minutes expiration)
    if market_upper in MARKET_NEWS_CACHE:
        cache_time, cached_data = MARKET_NEWS_CACHE[market_upper]
        if now - cache_time < timedelta(minutes=2):
            return cached_data
    else:
        prune_cache(MARKET_NEWS_CACHE, MAX_MARKET_NEWS_CACHE_SIZE)

    # Use a broader finance RSS source and add a local market-news RSS query so the app can surface region-specific headlines too.
    market_feed_map = {
        "US": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC",
        "PK": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC",
        "IN": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ENSEI",
        "UK": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EFTSE",
        "CA": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPTSE",
        "JP": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EN225",
        "DE": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGDAXI",
        "AU": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EAXJO",
        "SA": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ETadawul",
        "AE": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EADX",
        "CN": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EHSI",
        "QA": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EQLSI",
        "EG": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EEGX30",
        "TR": "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EBIST100"
    }

    local_query_map = {
        "PK": "PSX OR Pakistan Stock Exchange",
        "US": "S&P 500 OR Nasdaq OR US stocks",
        "IN": "NSE India OR Nifty OR Indian stocks",
        "UK": "FTSE OR London markets",
        "CA": "TSX OR Canadian stocks",
        "JP": "Nikkei OR Japanese stocks",
        "DE": "DAX OR German stocks",
        "AU": "ASX OR Australian stocks",
        "SA": "Tadawul OR Saudi stocks",
        "AE": "ADX OR UAE stocks",
        "CN": "Hang Seng OR Chinese markets",
        "QA": "Qatar stocks",
        "EG": "EGX OR Egyptian stocks",
        "TR": "Borsa Istanbul OR Turkish stocks"
    }

    regional_feed_map = {
        "PK": [
            "https://www.dawn.com/news/feed",
            "https://www.brecorder.com/feed",
            "https://www.thenews.com.pk/rss/1/1"
        ],
        "IN": [
            "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
            "https://www.thehindu.com/feeder/default.rss",
            "https://www.financialexpress.com/feed/"
        ],
        "US": [
            "https://feeds.feedburner.com/Reuters/BusinessNews",
            "https://www.wsj.com/xml/rss/3_7014.xml"
        ],
        "UK": [
            "https://feeds.feedburner.com/ft/topstories",
            "https://www.reutersagency.com/feed/?best-sectors=markets"
        ],
        "CA": [
            "https://www.reuters.com/world/americas/canada/rss",
            "https://financialpost.com/feed"
        ],
        "JP": [
            "https://www.reuters.com/world/asia/japan/rss",
            "https://www.nikkei.com/rss/"
        ],
        "DE": [
            "https://www.reuters.com/world/europe/germany/rss",
            "https://www.handelsblatt.com/rss"
        ],
        "AU": [
            "https://www.reuters.com/world/asia-pacific/australia/rss",
            "https://www.afr.com/rss"
        ],
        "SA": [
            "https://www.reuters.com/world/middle-east/saudi-arabia/rss",
            "https://www.arabnews.com/rss"
        ],
        "AE": [
            "https://www.reuters.com/world/middle-east/uae/rss",
            "https://www.thenationalnews.com/feeds/"
        ],
        "CN": [
            "https://www.reuters.com/world/china/rss",
            "https://www.scmp.com/rss"
        ],
        "QA": [
            "https://www.reuters.com/world/middle-east/qatar/rss",
            "https://www.gulf-times.com/rss"
        ],
        "EG": [
            "https://www.reuters.com/world/middle-east/egypt/rss",
            "https://english.ahram.org.eg/NewsRss.aspx"
        ],
        "TR": [
            "https://www.reuters.com/world/middle-east/turkey/rss",
            "https://www.dailysabah.com/rss"
        ]
    }

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    def parse_rss_items(response_content, source_name):
        root = ET.fromstring(response_content)
        items = root.findall(".//item")
        parsed_items = []
        for item in items[:8]:
            title = item.find("title").text if item.find("title") is not None else ""
            link = item.find("link").text if item.find("link") is not None else ""
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""

            parsed_pub_date = None
            for fmt in ["%a, %d %b %Y %H:%M:%S GMT", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
                try:
                    parsed_pub_date = datetime.strptime(pub_date, fmt)
                    break
                except Exception:
                    continue

            if not parsed_pub_date:
                try:
                    parsed_pub_date = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                except Exception:
                    parsed_pub_date = None

            if parsed_pub_date is not None:
                if parsed_pub_date.tzinfo is None:
                    parsed_pub_date = parsed_pub_date.replace(tzinfo=timezone.utc)
                elif parsed_pub_date.tzinfo != timezone.utc:
                    parsed_pub_date = parsed_pub_date.astimezone(timezone.utc)

            if parsed_pub_date and now - parsed_pub_date > timedelta(days=3):
                try:
                    if parsed_pub_date.year == now.year and parsed_pub_date.month == now.month and parsed_pub_date.day == now.day:
                        pass
                    else:
                        continue
                except Exception:
                    continue

            if not parsed_pub_date and not title:
                continue

            if not parsed_pub_date:
                parsed_pub_date = now

            if not title:
                continue

            sentiment = "neutral"
            lower_title = title.lower()
            if any(w in lower_title for w in ["gain", "bull", "surge", "up", "rise", "grow", "jump", "record high", "recovery", "profit"]):
                sentiment = "bullish"
            elif any(w in lower_title for w in ["fall", "slip", "bear", "down", "drop", "plunge", "decline", "slump", "loss", "crash"]):
                sentiment = "bearish"

            parsed_items.append({
                "title": title,
                "link": link,
                "pub_date": pub_date,
                "source": "Google News" if "PSX" in title.upper() or "local" in title.lower() or source_name == "Google News" else source_name,
                "sentiment": sentiment
            })
        return parsed_items

    news_list = []
    seen_links = set()
    try:
        yahoo_url = market_feed_map.get(market_upper, "https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC")
        local_query = local_query_map.get(market_upper, "stock market")
        google_url = f"https://news.google.com/rss/search?q={quote(local_query)}&hl=en-US&gl=US&ceid=US:en"

        sources = [("Google News", google_url), ("Yahoo Finance", yahoo_url)]
        if market_upper in regional_feed_map:
            for feed_url in regional_feed_map[market_upper]:
                sources.append((f"Regional Feed {market_upper}", feed_url))

        for source_name, url in sources:
            try:
                response = httpx.get(url, headers=headers, timeout=10.0)
                if response.status_code == 200:
                    effective_source_name = source_name
                    if "news.google.com" in url.lower() or source_name == "Google News":
                        effective_source_name = "Google News"
                    elif "finance.yahoo.com" in url.lower() or "yahoo" in url.lower() or source_name == "Yahoo Finance":
                        effective_source_name = "Yahoo Finance"
                    for item in parse_rss_items(response.content, effective_source_name):
                        key = item.get("link") or item.get("title")
                        if key and key not in seen_links:
                            seen_links.add(key)
                            news_list.append(item)
                        if len(news_list) >= 10:
                            break
            except Exception as e:
                print(f"[fetch_market_news] Error for {source_name}: {e}")

        if news_list:
            lower_query = local_query.lower()

            def get_news_priority(item):
                title = (item.get("title") or "").lower()
                source = (item.get("source") or "").lower()
                sentiment = item.get("sentiment")

                if sentiment == "bullish":
                    sentiment_rank = 3
                elif sentiment == "bearish":
                    sentiment_rank = 2
                else:
                    sentiment_rank = 1

                query_match = 1 if lower_query and any(term in title for term in lower_query.split()) else 0
                regional_bonus = 1 if "regional" in source or "google" in source or "yahoo" not in source else 0
                if query_match == 0 and "google" in source:
                    query_match = 1
                return (sentiment_rank, query_match, regional_bonus)

            news_list = sorted(news_list, key=get_news_priority, reverse=True)
            news_list = news_list[:10]
            MARKET_NEWS_CACHE[market_upper] = (now, news_list)
            prune_cache(MARKET_NEWS_CACHE, MAX_MARKET_NEWS_CACHE_SIZE)
            return news_list
    except Exception as e:
        print(f"[fetch_market_news] Error: {e}")

    MARKET_NEWS_CACHE[market_upper] = (now, fallback_news)
    prune_cache(MARKET_NEWS_CACHE, MAX_MARKET_NEWS_CACHE_SIZE)
    return fallback_news

def fetch_ticker_news(ticker: str, market: str = "PK") -> list:
    """
    Fetches stock-specific news from Yahoo Finance RSS (global markets)
    or Google News search (Pakistan/others).
    """
    import httpx
    import xml.etree.ElementTree as ET
    from datetime import datetime, timedelta

    ticker_upper = (ticker or "").upper()
    market_upper = (market or "PK").upper()
    now = datetime.now()
    
    cache_key = f"{market_upper}:{ticker_upper}"
    
    # Check cache (5 minutes expiration)
    if cache_key in TICKER_NEWS_CACHE:
        cache_time, cached_data = TICKER_NEWS_CACHE[cache_key]
        if now - cache_time < timedelta(minutes=5):
            return cached_data
    else:
        prune_cache(TICKER_NEWS_CACHE, MAX_TICKER_NEWS_CACHE_SIZE)
            
    news_list = []
    
    # Non-PK markets can utilize Yahoo Finance RSS
    if market_upper in ["US", "IN", "UK", "CA", "JP", "DE", "AU", "SA", "AE", "CN", "QA", "EG", "TR"]:
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker_upper}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        try:
            response = httpx.get(url, headers=headers, timeout=10.0)
            if response.status_code == 200:
                root = ET.fromstring(response.content)
                items = root.findall(".//item")
                for item in items[:8]:
                    title = item.find("title").text if item.find("title") is not None else ""
                    link = item.find("link").text if item.find("link") is not None else ""
                    pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                    
                    sentiment = "neutral"
                    lower_title = title.lower()
                    if any(w in lower_title for w in ["buy", "gain", "bull", "surge", "up", "rise", "grow", "outperform"]):
                        sentiment = "bullish"
                    elif any(w in lower_title for w in ["sell", "fall", "slip", "bear", "down", "drop", "plunge", "decline", "underperform"]):
                        sentiment = "bearish"
                        
                    news_list.append({
                        "title": title,
                        "link": link,
                        "pub_date": pub_date,
                        "source": "Yahoo Finance",
                        "sentiment": sentiment
                    })
                if news_list:
                    TICKER_NEWS_CACHE[cache_key] = (now, news_list)
                    prune_cache(TICKER_NEWS_CACHE, MAX_TICKER_NEWS_CACHE_SIZE)
                    return news_list
        except Exception as e:
            print(f"[fetch_ticker_news Yahoo] Error for {ticker_upper}: {e}")

    # Fallback/PK markets: query Google News
    profile = get_stock_profile(ticker_upper)
    company_name = profile.get("name", ticker_upper) if profile else ticker_upper
    
    # Clean up company suffix for better search results
    clean_name = company_name
    for suffix in ["Limited", "Ltd", "Company", "Corp", "Corporation", "Bank"]:
        if clean_name.endswith(suffix):
            clean_name = clean_name.rsplit(suffix, 1)[0].strip()
            
    query = f'"{clean_name}" stock OR "{ticker_upper}" PSX'
    if market_upper != "PK":
        query = f'"{clean_name}" stock OR "{ticker_upper}"'
        
    url = f"https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    try:
        response = httpx.get(url, headers=headers, timeout=10.0)
        if response.status_code == 200:
            root = ET.fromstring(response.content)
            items = root.findall(".//item")
            for item in items[:8]:
                title = item.find("title").text if item.find("title") is not None else ""
                link = item.find("link").text if item.find("link") is not None else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
                source = item.find("source").text if item.find("source") is not None else "Google News"

                try:
                    parsed_pub_date = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S GMT")
                except Exception:
                    parsed_pub_date = None

                if not parsed_pub_date:
                    try:
                        parsed_pub_date = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    except Exception:
                        parsed_pub_date = None

                if parsed_pub_date is not None:
                    if parsed_pub_date.tzinfo is None:
                        parsed_pub_date = parsed_pub_date.replace(tzinfo=timezone.utc)
                    elif parsed_pub_date.tzinfo != timezone.utc:
                        parsed_pub_date = parsed_pub_date.astimezone(timezone.utc)

                if parsed_pub_date and now - parsed_pub_date > timedelta(days=3):
                    continue

                if not parsed_pub_date:
                    continue
                
                sentiment = "neutral"
                lower_title = title.lower()
                if any(w in lower_title for w in ["gain", "bull", "surge", "up", "rise", "grow", "profit", "discovery"]):
                    sentiment = "bullish"
                elif any(w in lower_title for w in ["fall", "slip", "bear", "down", "drop", "plunge", "decline", "loss"]):
                    sentiment = "bearish"
                    
                news_list.append({
                    "title": title,
                    "link": link,
                    "pub_date": pub_date,
                    "source": source,
                    "sentiment": sentiment
                })
            
            TICKER_NEWS_CACHE[cache_key] = (now, news_list)
    except Exception as e:
        print(f"[fetch_ticker_news Google] Error for {ticker_upper}: {e}")
        
    # If both RSS attempts fail, return profile hardcoded news or a placeholder
    if not news_list:
        if profile and profile.get("recent_news"):
            return profile["recent_news"]
        else:
            return [
                {
                    "title": f"No recent news articles found for {ticker_upper}.",
                    "link": "#",
                    "pub_date": now.strftime("%a, %d %b %Y %H:%M:%S GMT"),
                    "source": "System",
                    "sentiment": "neutral"
                }
            ]
            
    return news_list

