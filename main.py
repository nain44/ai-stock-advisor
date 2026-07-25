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

app = FastAPI(
    title="PSX AI Stock Advisor API",
    description="Backend API for real-time and historical technical stock analysis and LLM advisory for Pakistan Stock Exchange.",
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

class SettingsUpdate(BaseModel):
    gemini_key: Optional[str] = None
    openai_key: Optional[str] = None

class HoldingItem(BaseModel):
    ticker: str
    quantity: int
    avgPrice: float

class PortfolioAnalysisRequest(BaseModel):
    portfolio: List[HoldingItem]

ANALYSIS_CACHE = {}

@app.get("/api/stocks")
def get_stocks(tickers: Optional[str] = None):
    """
    Returns list of PSX stocks with live quotes. 
    If 'tickers' is provided (comma-separated list of symbols), it returns only those tickers.
    Otherwise, it returns the default watchlist.
    """
    if tickers:
        ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    else:
        # Default list of active stocks
        ticker_list = ["MARI", "SYS", "LUCK", "ENGRO", "FFC", "UBL", "EFERT", "PSO", "DGKC", "HBL", "MEBL", "HUBC", "OGDC"]
        
    def fetch_quote_for_stock(ticker):
        quote = data_fetcher.get_latest_quote(ticker)
        profile = data_fetcher.get_stock_profile(ticker)
        
        name = profile["name"] if profile else ticker
        sector = profile["sector"] if profile else "PSX Equity"
        
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
            cached = ANALYSIS_CACHE.get(ticker)
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
def search_stocks(query: str):
    """Searches the complete list of standard listed PSX equities."""
    if not query or len(query) < 2:
        return []
    try:
        # Fetch standard equities list
        df = data_fetcher.psxdata.symbols()
        equities = df[(df['is_debt'] == False) & (df['is_gem'] == False)]
        query = query.upper()
        
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
def get_historical(ticker: str, days: int = 120):
    """Returns historical OHLCV candles data for charting."""
    profile = data_fetcher.get_stock_profile(ticker)
    if not profile:
        raise HTTPException(status_code=404, detail="Stock ticker not found.")
    df = data_fetcher.generate_historical_data(ticker, days)
    return df.to_dict(orient="records")

@app.get("/api/analysis/{ticker}")
def get_analysis(ticker: str):
    """
    Runs full technical analysis calculations on historical data,
    combines with latest profile data, and fetches AI recommendation.
    """
    # Fetch live quote (which has accurate price, change, sector, etc.)
    quote = data_fetcher.get_latest_quote(ticker)
    profile = data_fetcher.get_stock_profile(ticker)
    
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
    df = data_fetcher.generate_historical_data(ticker, 120)
    
    # Calculate indicators
    tech_analysis = technical_analysis.run_full_technical_analysis(df)
    
    # Fetch recommendation (LLM or Simulator)
    recommendation = ai_advisor.get_llm_recommendation(
        ticker=ticker,
        price=quote["price"],
        tech_analysis=tech_analysis,
        profile=live_profile
    )
    
    result = {
        "ticker": ticker,
        "profile": live_profile,
        "technical_analysis": tech_analysis,
        "recommendation": recommendation
    }
    ANALYSIS_CACHE[ticker] = result
    return result

@app.post("/api/portfolio/analysis")
def analyze_portfolio(req: PortfolioAnalysisRequest):
    """
    Evaluates the simulated portfolio and returns an AI recommendation report.
    """
    if not req.portfolio:
        raise HTTPException(status_code=400, detail="Portfolio cannot be empty.")
        
    total_cost = 0.0
    total_value = 0.0
    holdings_metrics = []
    
    for holding in req.portfolio:
        ticker = holding.ticker.upper()
        qty = holding.quantity
        avg_price = holding.avgPrice
        
        quote = data_fetcher.get_latest_quote(ticker)
        profile = data_fetcher.get_stock_profile(ticker)
        
        live_price = quote["price"] if quote else avg_price
        name = quote["name"] if quote else (profile["name"] if profile else ticker)
        sector = profile["sector"] if profile else "PSX Equity"
        
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
    
    ai_diagnosis = ai_advisor.get_portfolio_recommendation(portfolio_summary)
    
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
        portfolio=req.portfolio
    )
    return {"response": response_text}

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
