import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor

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

class HoldingItem(BaseModel):
    ticker: str
    quantity: int
    avgPrice: float

class PortfolioAnalysisRequest(BaseModel):
    portfolio: List[HoldingItem]
    market: Optional[str] = "PK"

ANALYSIS_CACHE = {}

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

@app.get("/api/stocks")
def get_stocks(tickers: Optional[str] = None, market: Optional[str] = "PK"):
    """
    Returns list of stocks with live quotes. 
    If 'tickers' is provided (comma-separated list of symbols), it returns only those tickers.
    Otherwise, it returns the default watchlist.
    """
    market_str = (market or "PK").upper()
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    else:
        if market_str == "US":
            ticker_list = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]
        elif market_str == "IN":
            ticker_list = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"]
        elif market_str == "UK":
            ticker_list = ["BP.L", "HSBA.L", "GSK.L", "AZN.L", "VOD.L"]
        else:
            # Default list of active stocks
            ticker_list = ["MARI", "SYS", "LUCK", "ENGRO", "FFC", "UBL", "EFERT", "PSO", "DGKC", "HBL", "MEBL", "HUBC", "OGDC"]
        
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
    """Searches standard listed PSX equities or US/IN/UK equities."""
    if not query or len(query) < 2:
        return []
    market_str = market or "PK"
    market_upper = market_str.upper()
    query = query.upper()
    
    if market_upper in ["US", "IN", "UK"]:
        if market_upper == "US":
            matches = [s for s in US_STOCK_INDEX if query in s["ticker"] or query in s["name"].upper()]
            sector = "US Equity"
            suffix = ""
        elif market_upper == "IN":
            matches = [s for s in IN_STOCK_INDEX if query in s["ticker"] or query in s["name"].upper()]
            sector = "Indian Equity"
            suffix = ".NS"
        else:  # UK
            matches = [s for s in UK_STOCK_INDEX if query in s["ticker"] or query in s["name"].upper()]
            sector = "UK Equity"
            suffix = ".L"
            
        # Fallback to direct ticker code injection for custom global lookups
        if len(query) >= 3 and len(query) <= 6 and not any(m["ticker"].split(".")[0] == query for m in matches):
            custom_ticker = f"{query}{suffix}" if not query.endswith(suffix) else query
            matches.insert(0, {"ticker": custom_ticker, "name": f"{query} - Custom {market_upper} Ticker", "sector": sector})
        return matches[:10]
        
    try:
        # Fetch standard equities list
        df = data_fetcher.psxdata.symbols()
        equities = df[(df['is_debt'] == False) & (df['is_gem'] == False)]
        
        # Filter matching tickers or names
        matches = equities[equities['symbol'].str.contains(query, na=False) | equities['name'].str.upper().str.contains(query, na=False)]
        
        results = []
        for _, row in matches.head(10).iterrows():
            results.append({
                "ticker": row["symbol"],
                "name": row["name"],
                "sector": "PSX Equity"
            })
        return results
    except Exception as e:
        print(f"Error searching symbols: {e}")
        return []

@app.get("/api/quote/{ticker}")
def get_quote(ticker: str):
    """Returns real-time simulated quote and news for specified stock."""
    quote = data_fetcher.get_latest_quote(ticker)
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
    
    # Fetch live quote (which has accurate price, change, sector, etc.)
    quote = data_fetcher.get_latest_quote(ticker, market=market_str)
    profile = data_fetcher.get_stock_profile(ticker) if market_upper != "US" else None
    
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
        if market_upper == "US":
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
                "description": quote.get("description", "US Equity"),
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
    ANALYSIS_CACHE[cache_key] = result
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
        profile = data_fetcher.get_stock_profile(ticker) if market_upper != "US" else None
        
        live_price = quote["price"] if quote else avg_price
        name = quote["name"] if quote else (profile["name"] if profile else ticker)
        sector = quote["sector"] if market_upper == "US" else (profile["sector"] if profile else "PSX Equity")
        
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
    return {
        "markets": {
            "PK": {
                "title": "MultiStocks AI",
                "subtitle": "Pakistan Stock Exchange (PSX)",
                "currency": "Rs.",
                "defaultTicker": "MARI",
                "watchlist": ["MARI", "SYS", "MEBL", "HUBC", "OGDC", "UBL"]
            },
            "US": {
                "title": "MultiStocks AI",
                "subtitle": "US Stock Markets (NYSE/NASDAQ)",
                "currency": "$",
                "defaultTicker": "AAPL",
                "watchlist": ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]
            },
            "IN": {
                "title": "MultiStocks AI",
                "subtitle": "National Stock Exchange of India (NSE)",
                "currency": "₹",
                "defaultTicker": "RELIANCE.NS",
                "watchlist": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"]
            },
            "UK": {
                "title": "MultiStocks AI",
                "subtitle": "London Stock Exchange (LSE)",
                "currency": "£",
                "defaultTicker": "BP.L",
                "watchlist": ["BP.L", "HSBA.L", "GSK.L", "AZN.L", "VOD.L"]
            }
        },
        "chat": {
            "welcome_messages": {
                "PK": "As-salamu alaykum! I am your KSE AI Stock Advisor. Ask me about technical patterns, targets, or specific PSX stocks.",
                "US": "Hello! I am your US Stocks AI Advisor. Ask me about technical patterns, targets, or specific NYSE/NASDAQ stocks.",
                "IN": "Namaste! I am your NSE India AI Stock Advisor. Ask me about technical patterns, targets, or specific Indian stocks.",
                "UK": "Hello! I am your UK Stocks AI Advisor. Ask me about technical patterns, targets, or specific London Stock Exchange (LSE) stocks."
            },
            "suggestion_chips": {
                "PK": [
                    {"label": "Analyze MARI", "query": "Can you do a full analysis of MARI and explain target levels?"},
                    {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
                    {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading PSX?"},
                    {"label": "Top Defensive Stocks", "query": "Which stocks in the PSX coverage are considered the best defensive/dividend stocks?"}
                ],
                "US": [
                    {"label": "Analyze AAPL", "query": "Can you do a full analysis of AAPL and explain target levels?"},
                    {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
                    {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading US markets?"},
                    {"label": "Top Defensive Stocks", "query": "Which stocks in the US markets coverage are considered the best defensive/dividend stocks?"}
                ],
                "IN": [
                    {"label": "Analyze RELIANCE.NS", "query": "Can you do a full analysis of RELIANCE.NS and explain target levels?"},
                    {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
                    {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading NSE?"},
                    {"label": "Top Defensive Stocks", "query": "Which stocks in the NSE coverage are considered the best defensive/dividend stocks?"}
                ],
                "UK": [
                    {"label": "Analyze BP.L", "query": "Can you do a full analysis of BP.L and explain target levels?"},
                    {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
                    {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading LSE?"},
                    {"label": "Top Defensive Stocks", "query": "Which stocks in the LSE coverage are considered the best defensive/dividend stocks?"}
                ]
            }
        }
    }

@app.get("/api/macro")
def get_macro(market: Optional[str] = "PK"):
    """
    Returns dynamic commodity rates (Gold, Silver, Oil) and exchange rates (Forex)
    localized to the requested market.
    """
    return macro_fetcher.get_macro_indicators(market)

@app.get("/api/settings")
def get_settings():
    """Returns status of API keys configuration without leaking secret contents."""
    return {
        "has_gemini": ai_advisor.has_gemini,
        "has_openai": ai_advisor.has_openai,
        "gemini_key_mask": "********" if ai_advisor.has_gemini else "",
        "openai_key_mask": "********" if ai_advisor.has_openai else "",
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
            
    # Save back to .env
    with open(".env", "w") as f:
        for k, v in env_dict.items():
            f.write(f"{k}={v}\n")
            
    return {"status": "success", "message": "Settings updated successfully"}

# Serve static files for frontend dashboard
try:
    os.makedirs("static", exist_ok=True)
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
except Exception as e:
    print(f"Static directory mounting failed: {e}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
