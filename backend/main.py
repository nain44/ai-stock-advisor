import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor
import datetime
import json
from urllib.parse import urlparse

DEFAULT_MOBILE_API_URL = "https://ai-stock-advisor-sp9b.onrender.com"

MAX_SYSTEM_EVENTS = 200
SYSTEM_EVENTS = [
    {"timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "message": "MultiStocks AI API Backend initialized."},
    {"timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "message": "Loaded market watchlists and global index feeds."}
]


def add_system_event(message: str):
    SYSTEM_EVENTS.append({
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "message": message,
    })
    if len(SYSTEM_EVENTS) > MAX_SYSTEM_EVENTS:
        del SYSTEM_EVENTS[: len(SYSTEM_EVENTS) - MAX_SYSTEM_EVENTS]


# Import local modules
import data_fetcher
import technical_analysis
import ai_advisor
import macro_fetcher

app = FastAPI(
    title="MultiStocks AI Advisory API",
    description="Backend API for real-time and historical technical stock analysis and LLM advisory for global stock markets.",
    version="1.0.0"
)

@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "backend"}

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    ticker: Optional[str] = None
    portfolio: Optional[List[dict]] = None
    market: Optional[str] = "PK"

class SettingsUpdate(BaseModel):
    gemini_key: Optional[str] = None
    openai_key: Optional[str] = None
    use_test_ads: Optional[bool] = None
    mobile_api_url: Optional[str] = None

class HoldingItem(BaseModel):
    ticker: str
    quantity: int
    avgPrice: float

class PortfolioAnalysisRequest(BaseModel):
    portfolio: List[HoldingItem]
    market: Optional[str] = "PK"

ANALYSIS_CACHE = {}
MAX_ANALYSIS_CACHE_SIZE = 200


def cache_analysis_result(cache_key: str, result: dict):
    ANALYSIS_CACHE[cache_key] = result
    if len(ANALYSIS_CACHE) > MAX_ANALYSIS_CACHE_SIZE:
        oldest_key = next(iter(ANALYSIS_CACHE))
        del ANALYSIS_CACHE[oldest_key]

US_STOCK_INDEX = [
    {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology"},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology"},
    {"ticker": "TSLA", "name": "Tesla, Inc.", "sector": "Automotive"},
    {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Semiconductors"},
    {"ticker": "AMZN", "name": "Amazon.com, Inc.", "sector": "E-Commerce"},
    {"ticker": "GOOG", "name": "Alphabet Inc.", "sector": "Technology"},
    {"ticker": "META", "name": "Meta Platforms, Inc.", "sector": "Technology"},
    {"ticker": "NFLX", "name": "Netflix, Inc.", "sector": "Entertainment"},
    {"ticker": "AMD", "name": "Advanced Micro Devices, Inc.", "sector": "Semiconductors"},
    {"ticker": "INTC", "name": "Intel Corporation", "sector": "Semiconductors"},
    {"ticker": "QCOM", "name": "Qualcomm Incorporated", "sector": "Semiconductors"},
    {"ticker": "AVGO", "name": "Broadcom Inc.", "sector": "Semiconductors"},
    {"ticker": "BABA", "name": "Alibaba Group Holding Limited", "sector": "E-Commerce"},
    {"ticker": "PYPL", "name": "PayPal Holdings, Inc.", "sector": "Financial Technology"},
    {"ticker": "V", "name": "Visa Inc.", "sector": "Financial Services"},
    {"ticker": "MA", "name": "Mastercard Incorporated", "sector": "Financial Services"},
    {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financial Services"},
    {"ticker": "BAC", "name": "Bank of America Corporation", "sector": "Financial Services"},
    {"ticker": "DIS", "name": "The Walt Disney Company", "sector": "Entertainment"},
    {"ticker": "NKE", "name": "NIKE, Inc.", "sector": "Apparel & Accessories"},
    {"ticker": "SBUX", "name": "Starbucks Corporation", "sector": "Consumer Services"},
    {"ticker": "KO", "name": "The Coca-Cola Company", "sector": "Beverages"},
    {"ticker": "PEP", "name": "PepsiCo, Inc.", "sector": "Beverages & Snacks"},
    {"ticker": "WMT", "name": "Walmart Inc.", "sector": "Retail"},
    {"ticker": "COST", "name": "Costco Wholesale Corporation", "sector": "Retail"}
]

IN_STOCK_INDEX = [
    {"ticker": "RELIANCE.NS", "name": "Reliance Industries Limited", "sector": "Energy"},
    {"ticker": "TCS.NS", "name": "Tata Consultancy Services Limited", "sector": "Technology"},
    {"ticker": "HDFCBANK.NS", "name": "HDFC Bank Limited", "sector": "Financial Services"},
    {"ticker": "INFY.NS", "name": "Infosys Limited", "sector": "Technology"},
    {"ticker": "ICICIBANK.NS", "name": "ICICI Bank Limited", "sector": "Financial Services"},
    {"ticker": "HINDUNILVR.NS", "name": "Hindustan Unilever Limited", "sector": "Consumer Defensive"},
    {"ticker": "ITC.NS", "name": "ITC Limited", "sector": "Consumer Defensive"},
    {"ticker": "SBIN.NS", "name": "State Bank of India", "sector": "Financial Services"},
    {"ticker": "BHARTIARTL.NS", "name": "Bharti Airtel Limited", "sector": "Telecommunications"},
    {"ticker": "LTIM.NS", "name": "LTIMindtree Limited", "sector": "Technology"}
]

UK_STOCK_INDEX = [
    {"ticker": "BP.L", "name": "BP p.l.c.", "sector": "Energy"},
    {"ticker": "HSBA.L", "name": "HSBC Holdings plc", "sector": "Financial Services"},
    {"ticker": "GSK.L", "name": "GSK plc", "sector": "Healthcare"},
    {"ticker": "AZN.L", "name": "AstraZeneca plc", "sector": "Healthcare"},
    {"ticker": "VOD.L", "name": "Vodafone Group Public Limited Company", "sector": "Telecommunications"},
    {"ticker": "SHEL.L", "name": "Shell plc", "sector": "Energy"},
    {"ticker": "BARC.L", "name": "Barclays PLC", "sector": "Financial Services"},
    {"ticker": "LLOY.L", "name": "Lloyds Banking Group plc", "sector": "Financial Services"},
    {"ticker": "ULVR.L", "name": "Unilever PLC", "sector": "Consumer Defensive"},
    {"ticker": "RIO.L", "name": "Rio Tinto Group", "sector": "Basic Materials"}
]

CA_STOCK_INDEX = [
    {"ticker": "RY.TO", "name": "Royal Bank of Canada", "sector": "Financial Services"},
    {"ticker": "TD.TO", "name": "The Toronto-Dominion Bank", "sector": "Financial Services"},
    {"ticker": "SHOP.TO", "name": "Shopify Inc.", "sector": "Technology"},
    {"ticker": "ENB.TO", "name": "Enbridge Inc.", "sector": "Energy"},
    {"ticker": "BNS.TO", "name": "The Bank of Nova Scotia", "sector": "Financial Services"},
    {"ticker": "CNR.TO", "name": "Canadian National Railway Company", "sector": "Industrials"}
]

JP_STOCK_INDEX = [
    {"ticker": "7203.T", "name": "Toyota Motor Corporation", "sector": "Automotive"},
    {"ticker": "6758.T", "name": "Sony Group Corporation", "sector": "Consumer Electronics"},
    {"ticker": "9984.T", "name": "SoftBank Group Corp.", "sector": "Telecommunications"},
    {"ticker": "8035.T", "name": "Tokyo Electron Limited", "sector": "Semiconductors"},
    {"ticker": "6861.T", "name": "Keyence Corporation", "sector": "Electronics"}
]

DE_STOCK_INDEX = [
    {"ticker": "SAP.DE", "name": "SAP SE", "sector": "Technology"},
    {"ticker": "SIE.DE", "name": "Siemens Aktiengesellschaft", "sector": "Conglomerates"},
    {"ticker": "ALV.DE", "name": "Allianz SE", "sector": "Financial Services"},
    {"ticker": "VOW3.DE", "name": "Volkswagen AG", "sector": "Automotive"},
    {"ticker": "MBG.DE", "name": "Mercedes-Benz Group AG", "sector": "Automotive"},
    {"ticker": "BAS.DE", "name": "BASF SE", "sector": "Chemicals"}
]

AU_STOCK_INDEX = [
    {"ticker": "BHP.AX", "name": "BHP Group Limited", "sector": "Basic Materials"},
    {"ticker": "CBA.AX", "name": "Commonwealth Bank of Australia", "sector": "Financial Services"},
    {"ticker": "RIO.AX", "name": "Rio Tinto Limited", "sector": "Basic Materials"},
    {"ticker": "TLS.AX", "name": "Telstra Group Limited", "sector": "Telecommunications"},
    {"ticker": "CSL.AX", "name": "CSL Limited", "sector": "Healthcare"}
]

SA_STOCK_INDEX = [
    {"ticker": "2222.SR", "name": "Saudi Arabian Oil Company", "sector": "Energy"},
    {"ticker": "1120.SR", "name": "Al Rajhi Banking & Investment Corp.", "sector": "Financial Services"},
    {"ticker": "1150.SR", "name": "Alinma Bank", "sector": "Financial Services"},
    {"ticker": "2010.SR", "name": "Saudi Basic Industries Corporation", "sector": "Chemicals"},
    {"ticker": "7010.SR", "name": "Saudi Telecom Company", "sector": "Telecommunications"}
]

AE_STOCK_INDEX = [
    {"ticker": "EMAAR.DU", "name": "Emaar Properties PJSC", "sector": "Real Estate"},
    {"ticker": "DEWA.DU", "name": "Dubai Electricity & Water Authority", "sector": "Utilities"},
    {"ticker": "DFM.DU", "name": "Dubai Financial Market PJSC", "sector": "Financial Services"},
    {"ticker": "TAQA.AD", "name": "Abu Dhabi National Energy Company", "sector": "Utilities"},
    {"ticker": "FAB.AD", "name": "First Abu Dhabi Bank PJSC", "sector": "Financial Services"}
]

CN_STOCK_INDEX = [
    {"ticker": "601398.SS", "name": "Industrial and Commercial Bank of China Limited", "sector": "Financial Services"},
    {"ticker": "600519.SS", "name": "Kweichow Moutai Co., Ltd.", "sector": "Beverages"},
    {"ticker": "601857.SS", "name": "PetroChina Company Limited", "sector": "Energy"},
    {"ticker": "600028.SS", "name": "China Petroleum & Chemical Corporation", "sector": "Energy"},
    {"ticker": "601988.SS", "name": "Bank of China Limited", "sector": "Financial Services"}
]

QA_STOCK_INDEX = [
    {"ticker": "QNBK.QA", "name": "Qatar National Bank (Q.P.S.C.)", "sector": "Financial Services"},
    {"ticker": "QGTS.QA", "name": "Qatar Gas Transport Company Limited (Nakilat)", "sector": "Industrials"},
    {"ticker": "IQCD.QA", "name": "Industries Qatar Q.P.S.C.", "sector": "Basic Materials"},
    {"ticker": "QEWS.QA", "name": "Qatar Electricity & Water Company Q.P.S.C.", "sector": "Utilities"},
    {"ticker": "QIBK.QA", "name": "Qatar Islamic Bank (Q.P.S.C.)", "sector": "Financial Services"}
]

EG_STOCK_INDEX = [
    {"ticker": "COMI.CA", "name": "Commercial International Bank (Egypt) S.A.E.", "sector": "Financial Services"},
    {"ticker": "EAST.CA", "name": "Eastern Company S.A.E.", "sector": "Consumer Defensive"},
    {"ticker": "SWDY.CA", "name": "Elsewedy Electric Co.", "sector": "Industrials"},
    {"ticker": "FWRY.CA", "name": "Fawry for Banking Technology and Electronic Payments S.A.E.", "sector": "Financial Technology"},
    {"ticker": "ETEL.CA", "name": "Telecom Egypt Company S.A.E.", "sector": "Telecommunications"}
]

IR_STOCK_INDEX = [
    {"ticker": "IRR=X", "name": "Iranian Rial Proxy Spot Exchange Rate", "sector": "Foreign Exchange"},
    {"ticker": "GC=F", "name": "Gold Spot Proxy Rate", "sector": "Precious Metals"},
    {"ticker": "SI=F", "name": "Silver Spot Proxy Rate", "sector": "Precious Metals"}
]

TR_STOCK_INDEX = [
    {"ticker": "THYAO.IS", "name": "Turk Hava Yollari Anonim Ortakligi", "sector": "Airlines"},
    {"ticker": "ASELS.IS", "name": "Aselsan Elektronik Sanayi ve Ticaret A.S.", "sector": "Defense & Aerospace"},
    {"ticker": "AKBNK.IS", "name": "Akbank T.A.S.", "sector": "Financial Services"},
    {"ticker": "EREGL.IS", "name": "Eregli Demir ve Celik Fabrikalari T.A.S.", "sector": "Basic Materials"},
    {"ticker": "TUPRS.IS", "name": "Turkiye Petrol Rafinerileri A.S.", "sector": "Energy"}
]

MARKETS_CONFIG = {}
try:
    markets_path = os.path.join(os.path.dirname(__file__), "markets.json")
    if os.path.exists(markets_path):
        with open(markets_path, "r", encoding="utf-8") as f:
            MARKETS_CONFIG = json.load(f)
except Exception as e:
    print(f"Error loading markets.json on startup: {e}")

@app.get("/api/stocks")
def get_stocks(tickers: Optional[str] = None, market: Optional[str] = "PK"):
    """
    Returns list of stocks with live quotes. 
    If 'tickers' is provided (comma-separated list of symbols), it returns only those tickers.
    Otherwise, it returns the default watchlist.
    """
    market_str = (market or "PK").upper()
    add_system_event(f"Quotes requested for market: {market_str} (tickers: {tickers or 'default'})")
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    else:
        market_data = MARKETS_CONFIG.get(market_str, MARKETS_CONFIG["PK"])
        ticker_list = market_data["watchlist"]
        
    def fetch_quote_for_stock(ticker):
        quote = data_fetcher.get_latest_quote(ticker, market=market_str)
        profile = data_fetcher.get_stock_profile(ticker) if market_str == "PK" else None
        
        name = profile.get("name") if profile else (quote.get("name") or ticker if quote else ticker)
        sector = profile.get("sector") if profile else (quote.get("sector") or "Global Equity" if quote else "Global Equity")
        
        if quote:
            # Parse pct_change string safely
            pct_val = 0.0
            pct_str = quote.get("pct_change", "0%")
            if pct_str and "%" in pct_str:
                try:
                    pct_val = float(pct_str.replace("%", ""))
                except Exception:
                    pct_val = 0.0
                    
            # Retrieve from cache if exists
            cache_key = f"{market_str.upper()}:{ticker}"
            cached = ANALYSIS_CACHE.get(cache_key)
            if cached and cached.get("recommendation"):
                signal = cached["recommendation"].get("recommendation", "HOLD")
            else:
                if pct_val > 0.5:
                    signal = "BUY"
                elif pct_val < -0.5:
                    signal = "SELL"
                else:
                    signal = "HOLD"
                    
            return {
                "ticker": ticker,
                "name": quote.get("name") or name,
                "sector": quote.get("sector") or sector,
                "current_price": quote.get("price") or 0.0,
                "change": quote.get("change") or 0.0,
                "change_percent": pct_val,
                "high": quote.get("high") or 0.0,
                "low": quote.get("low") or 0.0,
                "volume": quote.get("volume") or 0,
                "ldcp": quote.get("ldcp") or 0.0,
                "signal": signal
            }
        else:
            return {
                "ticker": ticker,
                "name": name,
                "sector": sector,
                "current_price": 0.0,
                "change": 0.0,
                "change_percent": 0.0,
                "high": 0.0,
                "low": 0.0,
                "volume": 0,
                "ldcp": 0.0,
                "signal": "HOLD"
            }
            
    with ThreadPoolExecutor(max_workers=15) as executor:
        detailed_stocks = list(executor.map(fetch_quote_for_stock, ticker_list))
        
    return detailed_stocks


@app.get("/api/search")
def search_stocks(query: str, market: Optional[str] = "PK"):
    """Searches standard listed PSX equities or global equities."""
    if not query or len(query) < 2:
        return []
    market_str = (market or "PK").upper()
    query = query.upper()
    
    suffixes = {
        "US": "",
        "IN": ".NS",
        "UK": ".L",
        "CA": ".TO",
        "JP": ".T",
        "DE": ".DE",
        "AU": ".AX",
        "SA": ".SR",
        "AE": ".DU",
        "CN": ".SS",
        "QA": ".QA",
        "EG": ".CA",
        "IR": "=X",
        "TR": ".IS"
    }
    
    indices = {
        "US": US_STOCK_INDEX,
        "IN": IN_STOCK_INDEX,
        "UK": UK_STOCK_INDEX,
        "CA": CA_STOCK_INDEX,
        "JP": JP_STOCK_INDEX,
        "DE": DE_STOCK_INDEX,
        "AU": AU_STOCK_INDEX,
        "SA": SA_STOCK_INDEX,
        "AE": AE_STOCK_INDEX,
        "CN": CN_STOCK_INDEX,
        "QA": QA_STOCK_INDEX,
        "EG": EG_STOCK_INDEX,
        "IR": IR_STOCK_INDEX,
        "TR": TR_STOCK_INDEX
    }
    
    is_global = market_str in suffixes or (market_str in MARKETS_CONFIG and market_str != "PK")
    
    if is_global:
        index_list = indices.get(market_str, [])
        # If no hardcoded index exists, build one from the market's watchlist
        if not index_list and market_str in MARKETS_CONFIG:
            market_data = MARKETS_CONFIG[market_str]
            watchlist = market_data.get("watchlist", [])
            index_list = []
            for ticker in watchlist:
                index_list.append({
                    "ticker": ticker,
                    "name": f"{ticker} - Watchlist Stock",
                    "sector": f"{market_data.get('name', market_str)} Equity"
                })
                
        matches = [s for s in index_list if query in s["ticker"] or query in s["name"].upper()]
        
        # Determine suffix dynamically
        suffix = ""
        if market_str in suffixes:
            suffix = suffixes[market_str]
        elif market_str in MARKETS_CONFIG:
            market_data = MARKETS_CONFIG[market_str]
            default_ticker = market_data.get("defaultTicker", "")
            if "." in default_ticker:
                suffix = "." + default_ticker.split(".", 1)[1]
            elif "=" in default_ticker:
                suffix = "=" + default_ticker.split("=", 1)[1]
            else:
                for ticker in market_data.get("watchlist", []):
                    if "." in ticker:
                        suffix = "." + ticker.split(".", 1)[1]
                        break
                    elif "=" in ticker:
                        suffix = "=" + ticker.split("=", 1)[1]
                        break
                        
        sector = f"{market_str} Equity"
        if market_str in MARKETS_CONFIG:
            sector = f"{MARKETS_CONFIG[market_str].get('name', market_str)} Equity"
            
        if len(query) >= 3 and len(query) <= 6 and not any(m["ticker"].split(".")[0] == query for m in matches):
            custom_ticker = f"{query}{suffix}" if not query.endswith(suffix) else query
            matches.insert(0, {"ticker": custom_ticker, "name": f"{query} - Custom {market_str} Ticker", "sector": sector})
        return matches[:10]
        
    try:
        # Fetch standard equities list (cached, with static fallback if live fetch fails)
        symbol_index = data_fetcher.get_pk_symbol_index()

        matches = [
            s for s in symbol_index
            if query in s["ticker"].upper() or query in s["name"].upper()
        ]
        return matches[:10]
    except Exception as e:
        print(f"Error searching symbols: {e}")
        return []

@app.get("/api/quote/{ticker}")
def get_quote(ticker: str, market: Optional[str] = "PK"):
    """Returns real-time simulated quote and news for the specified stock."""
    market_str = market or "PK"
    quote = data_fetcher.get_latest_quote(ticker, market=market_str)
    if not quote:
        raise HTTPException(status_code=404, detail="Stock ticker not found.")
    return quote

@app.get("/api/historical/{ticker}")
def get_historical(ticker: str, days: int = 120, market: Optional[str] = "PK"):
    """Returns historical daily candles for a stock."""
    market_str = market or "PK"
    df = data_fetcher.generate_historical_data(ticker, days, market=market_str)
    return df.to_dict(orient="records")

@app.get("/api/analysis/{ticker}")
def get_analysis(ticker: str, market: Optional[str] = "PK"):
    """
    Runs full technical analysis calculations on historical data,
    combines with latest profile data, and fetches AI recommendation.
    """
    market_str = market or "PK"
    market_upper = market_str.upper()
    add_system_event(f"Full analysis executed for ticker: {ticker.upper()} ({market_upper})")
    
    # Fetch live quote (which has accurate price, change, sector, etc.)
    quote = data_fetcher.get_latest_quote(ticker, market=market_str)
    profile = data_fetcher.get_stock_profile(ticker) if market_upper == "PK" else None
    
    if not quote:
        if not profile:
            raise HTTPException(status_code=404, detail="Stock ticker not found.")
        # Make a mock quote from profile
        quote = {
            "ticker": ticker,
            "name": profile.get("name", ticker),
            "price": profile.get("current_price", 0.0),
            "change": 0.0,
            "pct_change": "0.0%",
            "is_up": True,
            "high": profile.get("current_price", 0.0),
            "low": profile.get("current_price", 0.0),
            "ldcp": profile.get("current_price", 0.0),
            "volume": profile.get("volume_avg", 0),
            "pe": profile.get("pe_ratio", 0.0),
            "roe": profile.get("roe", 0.0),
            "div_yield": profile.get("div_yield", 0.0),
            "news": profile.get("recent_news", [])
        }
        live_profile = profile
    else:
        # Build profile from quote to match frontend expected fields
        if market_upper != "PK":
            live_profile = {
                "name": quote["name"],
                "sector": quote["sector"],
                "current_price": quote["price"],
                "change": quote["change"],
                "change_percent": float(quote["pct_change"].replace("%", "")) if "%" in quote["pct_change"] else 0.0,
                "high": quote["high"],
                "low": quote["low"],
                "volume_avg": quote["volume"],
                "pe_ratio": quote["pe"],
                "pb_ratio": quote.get("pb_ratio", 1.0),
                "debt_equity": quote.get("debt_equity", 0.0),
                "roe": quote.get("roe", 0.0),
                "div_yield": quote.get("div_yield", 0.0),
                "eps": quote.get("eps", 0.0),
                "description": quote.get("description", f"{market_upper} Equity"),
                "recent_news": quote.get("news", [])
            }
        else:
            sector = profile["sector"] if profile else "PSX Equity"
            live_profile = {
                "name": quote["name"],
                "sector": sector,
                "current_price": quote["price"],
                "change": quote["change"],
                "change_percent": float(quote["pct_change"].replace("%", "")) if "%" in quote["pct_change"] else 0.0,
                "high": quote["high"],
                "low": quote["low"],
                "volume_avg": quote["volume"],
                "pe_ratio": quote["pe"],
                "pb_ratio": profile.get("pb_ratio", 1.0) if profile else 1.0,
                "debt_equity": profile.get("debt_equity", 0.0) if profile else 0.0,
                "roe": quote["roe"] if quote["roe"] else (profile.get("roe", 0.0) if profile else 0.0),
                "div_yield": quote["div_yield"],
                "eps": profile.get("eps", 0.0) if profile else 0.0,
                "description": profile.get("description", "A listed equity on the Pakistan Stock Exchange.") if profile else "A listed equity on the Pakistan Stock Exchange.",
                "recent_news": quote["news"]
            }
            
    # Fetch live ticker news dynamically
    live_profile["recent_news"] = data_fetcher.fetch_ticker_news(ticker, market=market_str)
            
    # Generate historical candles
    df = data_fetcher.generate_historical_data(ticker, 120, market=market_str)
    
    # Calculate indicators
    tech_analysis = technical_analysis.run_full_technical_analysis(df)
    
    # Fetch recommendation (LLM or Simulator)
    recommendation = ai_advisor.get_llm_recommendation(
        ticker=ticker,
        price=quote["price"],
        tech_analysis=tech_analysis,
        profile=live_profile,
        market=market_str
    )
    
    # Cache the analysis result
    cache_key = f"{market_upper}:{ticker}"
    result = {
        "ticker": ticker,
        "profile": live_profile,
        "technical_analysis": tech_analysis,
        "recommendation": recommendation
    }
    cache_analysis_result(cache_key, result)
    return result

@app.post("/api/portfolio/analysis")
def analyze_portfolio(req: PortfolioAnalysisRequest):
    """
    Evaluates the simulated portfolio and returns an AI recommendation report.
    """
    if not req.portfolio:
        raise HTTPException(status_code=400, detail="Portfolio cannot be empty.")
        
    market_str = req.market or "PK"
    market_upper = market_str.upper()
    total_cost = 0.0
    total_value = 0.0
    holdings_metrics = []
    
    for holding in req.portfolio:
        ticker = holding.ticker.upper()
        qty = holding.quantity
        avg_price = holding.avgPrice
        
        quote = data_fetcher.get_latest_quote(ticker, market=market_str)
        profile = data_fetcher.get_stock_profile(ticker) if market_upper == "PK" else None
        
        live_price = quote["price"] if quote else avg_price
        name = quote["name"] if quote else (profile["name"] if profile else ticker)
        sector = quote["sector"] if market_upper != "PK" else (profile["sector"] if profile else "PSX Equity")
        
        cost_val = avg_price * qty
        current_val = live_price * qty
        pnl_val = current_val - cost_val
        pnl_pct = (pnl_val / cost_val) * 100 if cost_val > 0 else 0.0
        
        total_cost += cost_val
        total_value += current_val
        
        holdings_metrics.append({
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "quantity": qty,
            "avg_buy_price": avg_price,
            "current_price": live_price,
            "total_cost": cost_val,
            "current_value": current_val,
            "pnl": pnl_val,
            "pnl_percent": pnl_pct
        })
        
    sector_weights = {}
    for h in holdings_metrics:
        w = (h["current_value"] / total_value) * 100 if total_value > 0 else 0.0
        h["weight_percent"] = round(w, 2)
        sector_weights[h["sector"]] = sector_weights.get(h["sector"], 0.0) + w
        
    for sec in sector_weights:
        sector_weights[sec] = round(sector_weights[sec], 2)
        
    portfolio_summary = {
        "total_cost": round(total_cost, 2),
        "total_value": round(total_value, 2),
        "total_pnl": round(total_value - total_cost, 2),
        "total_pnl_percent": round(((total_value - total_cost) / total_cost) * 100, 2) if total_cost > 0 else 0.0,
        "holdings": holdings_metrics,
        "sector_allocation": sector_weights
    }
    
    ai_diagnosis = ai_advisor.get_portfolio_recommendation(portfolio_summary, market=market_str)
    
    return {
        "summary": portfolio_summary,
        "analysis": ai_diagnosis
    }

@app.post("/api/chat")
def chat_advisor(req: ChatRequest):
    """
    Chat endpoint for interaction with the AI Advisor.
    Supports portfolio details and active stock ticker context.
    """
    if not req.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    add_system_event(f"AI chat advisor queried. Stock context: {req.ticker or 'None'}")
    response_text = ai_advisor.query_chat_advisor(
        query=req.query,
        ticker_context=req.ticker,
        portfolio=req.portfolio,
        market=req.market
    )
    return {"response": response_text}

@app.get("/api/config")
def get_config():
    """
    Returns global project configurations, markets, and chat configurations
    to enable dynamic server-driven UI updates on the mobile app.
    """
    markets_data = {}
    welcome_messages = {}
    suggestion_chips = {}
    
    for key, val in MARKETS_CONFIG.items():
        markets_data[key] = {
            "name": val["name"],
            "flag": val["flag"],
            "title": val["title"],
            "subtitle": val["subtitle"],
            "currency": val["currency"],
            "defaultTicker": val["defaultTicker"],
            "watchlist": val["watchlist"]
        }
        welcome_messages[key] = val["welcome"]
        suggestion_chips[key] = val["suggestions"]
        
    return {
        "markets": markets_data,
        "chat": {
            "welcome_messages": welcome_messages,
            "suggestion_chips": suggestion_chips
        }
    }

@app.get("/api/news")
def get_news(market: Optional[str] = "PK"):
    """
    Returns dynamic market-wide recent financial news from Google News RSS feed.
    """
    market_str = (market or "PK").upper()
    return data_fetcher.fetch_market_news(market_str)

@app.get("/api/macro")
def get_macro(market: Optional[str] = "PK"):
    """
    Returns dynamic commodity rates (Gold, Silver, Oil) and exchange rates (Forex)
    localized to the requested market.
    """
    market_str = (market or "PK").upper()
    market_data = MARKETS_CONFIG.get(market_str, MARKETS_CONFIG.get("PK", {}))
    index_symbol = market_data.get("index_symbol", "^KSE")
    
    # Resolve clean index name
    subtitle = market_data.get("subtitle", "Stock Index")
    index_name = subtitle.split(" (")[0] if " (" in subtitle else subtitle
    
    # Custom index names map for standard markets
    index_names_map = {
        "^KSE": "KSE100",
        "^GSPC": "S&P 500",
        "^NSEI": "NIFTY 50",
        "^FTSE": "FTSE 100",
        "^GSPTSE": "S&P/TSX",
        "^N225": "Nikkei 225",
        "^GDAXI": "DAX",
        "^AXJO": "S&P/ASX 200",
        "^TASI.SR": "Tadawul",
        "^DFMGI": "DFMGI",
        "000001.SS": "SSE Composite",
        "^QE": "QE General",
        "^EGX30": "EGX 30",
        "IRR=X": "USD/IRR",
        "XU100.IS": "BIST 100"
    }
    index_name = index_names_map.get(index_symbol, index_name)
    
    return macro_fetcher.get_macro_indicators(market_str, index_symbol, index_name)

@app.get("/api/settings")
def get_settings():
    """Returns status of API keys plus mobile application settings."""
    return {
        "has_gemini": ai_advisor.has_gemini,
        "has_openai": ai_advisor.has_openai,
        "gemini_key_mask": "********" if ai_advisor.has_gemini else "",
        "openai_key_mask": "********" if ai_advisor.has_openai else "",
        "use_test_ads": os.getenv("USE_TEST_ADS", "true").lower() == "true",
        "mobile_api_url": os.getenv("MOBILE_API_URL", DEFAULT_MOBILE_API_URL),
    }

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate):
    """Updates API keys dynamically, writes to .env, and re-initializes models."""
    env_lines = []
    
    # Read existing env lines if .env exists
    if os.path.exists(".env"):
        with open(".env", "r") as f:
            env_lines = f.readlines()
            
    env_dict = {}
    for line in env_lines:
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.strip().split("=", 1)
            env_dict[k.strip()] = v.strip()
            
    # Update keys
    if settings.gemini_key is not None:
        env_dict["GEMINI_API_KEY"] = settings.gemini_key
        # Update in-memory
        if settings.gemini_key.strip():
            try:
                import google.generativeai as genai
                genai.configure(api_key=settings.gemini_key.strip())
                ai_advisor.has_gemini = True
                ai_advisor.GEMINI_API_KEY = settings.gemini_key.strip()
            except Exception as e:
                ai_advisor.has_gemini = False
        else:
            ai_advisor.has_gemini = False
            ai_advisor.GEMINI_API_KEY = ""

    if settings.openai_key is not None:
        env_dict["OPENAI_API_KEY"] = settings.openai_key
        # Update in-memory
        if settings.openai_key.strip():
            try:
                from openai import OpenAI
                ai_advisor.openai_client = OpenAI(api_key=settings.openai_key.strip())
                ai_advisor.has_openai = True
                ai_advisor.OPENAI_API_KEY = settings.openai_key.strip()
            except Exception as e:
                ai_advisor.has_openai = False
        else:
            ai_advisor.has_openai = False
            ai_advisor.OPENAI_API_KEY = ""
            
    if settings.use_test_ads is not None:
        env_dict["USE_TEST_ADS"] = "true" if settings.use_test_ads else "false"
        os.environ["USE_TEST_ADS"] = "true" if settings.use_test_ads else "false"

    if settings.mobile_api_url is not None:
        mobile_api_url = settings.mobile_api_url.strip().rstrip("/")
        parsed_url = urlparse(mobile_api_url)
        if parsed_url.scheme != "https" or not parsed_url.netloc:
            raise HTTPException(status_code=400, detail="Mobile API URL must be a valid HTTPS URL.")
        env_dict["MOBILE_API_URL"] = mobile_api_url
        os.environ["MOBILE_API_URL"] = mobile_api_url
            
    # Save back to .env
    with open(".env", "w") as f:
        for k, v in env_dict.items():
            f.write(f"{k}={v}\n")
            
    return {"status": "success", "message": "Settings updated successfully"}

class PromptUpdate(BaseModel):
    portfolio_prompt: Optional[str] = None
    chat_prompt: Optional[str] = None

@app.get("/api/admin/prompt")
def get_admin_prompt():
    import json
    path = os.path.join(os.path.dirname(__file__), "prompts.json")
    default_portfolio = "You are a premier quantitative financial analyst and portfolio manager advising a retail investor on their {exchange_name} portfolio.\nAnalyze the following portfolio summary details and return a structured JSON response evaluating its risk, performance, diversification, and actionable rebalancing."
    default_chat = "You are a professional financial advisor for {market_name}.\n{context}\nUser asks: '{query}'\n\nProvide a clear, detailed, professional answer in markdown. Mention tickers, numbers, and structural arguments (inflation, interest rates, earnings) where relevant."
    
    portfolio_prompt = default_portfolio
    chat_prompt = default_chat
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                portfolio_prompt = data.get("portfolio_prompt", default_portfolio)
                chat_prompt = data.get("chat_prompt", default_chat)
        except Exception:
            pass
            
    return {
        "portfolio_prompt": portfolio_prompt,
        "chat_prompt": chat_prompt
    }

@app.post("/api/admin/prompt")
def update_admin_prompt(req: PromptUpdate):
    import json
    path = os.path.join(os.path.dirname(__file__), "prompts.json")
    data = {}
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass
            
    if req.portfolio_prompt is not None:
        data["portfolio_prompt"] = req.portfolio_prompt
    if req.chat_prompt is not None:
        data["chat_prompt"] = req.chat_prompt
        
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        add_system_event("System prompt templates updated by admin.")
        return {"status": "success", "message": "Prompts updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/fetcher/trigger")
def trigger_fetcher(market: Optional[str] = "PK"):
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    add_system_event(f"Manual fetcher triggered for market: {market}")
    try:
        market_str = (market or "PK").upper()
        watchlist = MARKETS_CONFIG.get(market_str, MARKETS_CONFIG["PK"])["watchlist"]
        for ticker in watchlist:
            data_fetcher.get_latest_quote(ticker, market=market_str)
        add_system_event(f"Fetcher completed: refreshed watchlist tickers for {market_str}")
        return {"status": "success", "message": f"Data refresh completed for market {market_str}"}
    except Exception as e:
        add_system_event(f"Fetcher failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/logs")
def get_admin_logs():
    return SYSTEM_EVENTS

@app.get("/api/admin/markets")
def get_admin_markets():
    return MARKETS_CONFIG

@app.post("/api/admin/markets")
def update_admin_markets(new_config: dict):
    global MARKETS_CONFIG
    markets_path = os.path.join(os.path.dirname(__file__), "markets.json")
    try:
        with open(markets_path, "w", encoding="utf-8") as f:
            json.dump(new_config, f, indent=2, ensure_ascii=False)
        MARKETS_CONFIG = new_config
        add_system_event("Markets and watchlists configurations updated by admin.")
        return {"status": "success", "message": "Markets configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files for frontend dashboard
try:
    os.makedirs("static", exist_ok=True)
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
except Exception as e:
    print(f"Static directory mounting failed: {e}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "false").lower() == "true"
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=reload)
