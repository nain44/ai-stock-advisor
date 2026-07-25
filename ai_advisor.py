import os
import json
import random
from dotenv import load_dotenv
import data_fetcher

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize LLM Clients if keys exist
has_gemini = False
has_openai = False

if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        has_gemini = True
        print("Gemini API successfully configured.")
    except Exception as e:
        print(f"Error configuring Gemini API: {e}")

if OPENAI_API_KEY:
    try:
        from openai import OpenAI
        openai_client = OpenAI(api_key=OPENAI_API_KEY)
        has_openai = True
        print("OpenAI API successfully configured.")
    except Exception as e:
        print(f"Error configuring OpenAI API: {e}")

def get_rule_based_recommendation(ticker: str, price: float, tech_analysis: dict, profile: dict) -> dict:
    """
    Formulates a detailed, analytical, rule-based recommendation for Simulator Mode.
    Looks at actual RSI, MACD, and fundamental ratios.
    """
    rsi_val = tech_analysis["rsi"]["value"]
    macd_cross = tech_analysis["macd"]["crossover"]
    pe = profile["pe_ratio"]
    roe = profile["roe"]
    sector = profile["sector"]
    
    # Calculate score based on indicators
    score = 50  # Start neutral
    reasons = []
    
    # 1. RSI Score contribution
    if rsi_val < 30:
        score += 20
        reasons.append(f"RSI is oversold ({rsi_val}), suggesting a strong rebound candidate")
    elif rsi_val < 45:
        score += 10
        reasons.append(f"RSI is recovering ({rsi_val}) and building bullish momentum")
    elif rsi_val > 70:
        score -= 20
        reasons.append(f"RSI is overbought ({rsi_val}), representing high short-term correction risk")
    elif rsi_val > 55:
        score -= 5
        reasons.append(f"RSI is moderately high ({rsi_val}), trading close to local resistance levels")
    else:
        reasons.append(f"RSI is stable at {rsi_val}, suggesting balanced consolidation")
        
    # 2. MACD contribution
    if macd_cross == "Bullish Crossover":
        score += 15
        reasons.append("MACD indicator triggered a bullish crossover (Line crossed above Signal line)")
    elif macd_cross == "Bearish Crossover":
        score -= 15
        reasons.append("MACD indicator triggered a bearish crossover (Line crossed below Signal line)")
    else:
        # Check sign of histogram
        hist = tech_analysis["macd"]["histogram"]
        if hist > 0:
            score += 5
            reasons.append("MACD histogram is positive, indicating upward momentum")
        else:
            score -= 5
            reasons.append("MACD histogram is negative, indicating weak price action")
            
    # 3. Volume analysis
    vol_ratio = tech_analysis["volume"]["ratio"]
    if vol_ratio > 1.3:
        if rsi_val < 50:
            score += 8
            reasons.append(f"Trading volume is {int((vol_ratio-1)*100)}% above average, showing high accumulation interest")
        else:
            score -= 5
            reasons.append(f"High trading volume ({vol_ratio}x avg) at elevated prices suggests profit-taking")
            
    # 4. Fundamentals contribution
    if pe < 7.0 and roe > 20.0:
        score += 12
        reasons.append(f"Compelling valuations: Under-valued PE ratio of {pe} coupled with strong ROE of {roe}%")
    elif pe > 18.0:
        score -= 10
        reasons.append(f"High P/E multiple of {pe}x requires strong earnings growth to sustain current price")
        
    # Add news sentiments
    bullish_news = [n for n in profile["recent_news"] if n["sentiment"] == "bullish"]
    bearish_news = [n for n in profile["recent_news"] if n["sentiment"] == "bearish"]
    
    if len(bullish_news) > len(bearish_news):
        score += 8
        reasons.append("Positive corporate announcements and macro news sentiment")
    elif len(bearish_news) > len(bullish_news):
        score -= 8
        reasons.append("Recent regulatory or industry developments pressing margins")
        
    # Determine Recommendation
    if score >= 65:
        rec = "BUY"
        risk_level = "Medium" if score < 75 else "Low"
    elif score <= 38:
        rec = "SELL"
        risk_level = "High" if score < 28 else "Medium"
    else:
        rec = "HOLD"
        risk_level = "Low"
        
    # Force some variance to simulate market analyst expectations
    confidence = min(max(int(score + random.randint(-5, 5)), 40), 96)
    
    # Calculate Entry, Stop Loss, Targets relative to price
    if rec == "BUY":
        entry = round(price * 0.99, 1)
        target1 = round(price * 1.07, 1)
        target2 = round(price * 1.12, 1)
        stop_loss = round(price * 0.95, 1)
    elif rec == "SELL":
        entry = round(price, 1)
        target1 = round(price * 0.93, 1)
        target2 = round(price * 0.88, 1)
        stop_loss = round(price * 1.05, 1)
    else: # HOLD
        entry = round(price, 1)
        target1 = round(price * 1.04, 1)
        target2 = round(price * 1.08, 1)
        stop_loss = round(price * 0.94, 1)
        
    return {
        "ticker": ticker,
        "name": profile["name"],
        "recommendation": rec,
        "entry": entry,
        "target1": target1,
        "target2": target2,
        "stop_loss": stop_loss,
        "confidence": f"{confidence}%",
        "risk_level": risk_level,
        "reasons": reasons,
        "is_simulated": True
    }

def get_llm_recommendation(ticker: str, price: float, tech_analysis: dict, profile: dict) -> dict:
    """
    Queries Gemini or OpenAI using structured prompts.
    Falls back to rule-based engine if APIs fail or keys are invalid.
    """
    ticker = ticker.upper()
    
    # Prepare prompt data
    prompt_data = {
        "Ticker": ticker,
        "Company Name": profile["name"],
        "Sector": profile["sector"],
        "Current Price": price,
        "Fundamentals": {
            "P/E Ratio": profile["pe_ratio"],
            "ROE (%)": profile["roe"],
            "Dividend Yield (%)": profile["div_yield"],
            "Debt/Equity (%)": profile["debt_equity"],
            "EPS": profile["eps"]
        },
        "Technical Indicators": {
            "RSI (14)": tech_analysis["rsi"]["value"],
            "RSI Status": tech_analysis["rsi"]["status"],
            "MACD Crossover": tech_analysis["macd"]["crossover"],
            "MACD Line": tech_analysis["macd"]["line"],
            "MACD Signal": tech_analysis["macd"]["signal"],
            "Price Relative to SMA 50": tech_analysis["moving_averages"]["sma_50_status"],
            "Price Relative to SMA 200": tech_analysis["moving_averages"]["sma_200_status"],
            "Bollinger Bands status": tech_analysis["bollinger_bands"]["status"],
            "Volume Status": tech_analysis["volume"]["status"],
            "Volume Ratio": tech_analysis["volume"]["ratio"]
        },
        "Recent News": profile["recent_news"],
        "Business Description": profile["description"]
    }
    
    prompt = f"""
    You are an expert financial analyst advising retail investors on the Pakistan Stock Exchange (PSX).
    Analyze the following stock data carefully and provide a structured JSON response:
    
    {json.dumps(prompt_data, indent=2)}
    
    Provide your advice in the following exact JSON format:
    {{
        "ticker": "{ticker}",
        "name": "{profile["name"]}",
        "recommendation": "BUY" or "SELL" or "HOLD",
        "entry": <reasonable entry price as float>,
        "target1": <target price 1 as float>,
        "target2": <target price 2 as float>,
        "stop_loss": <suggested stop loss as float>,
        "confidence": "<confidence score between 10% and 99%, e.g., '84%'>",
        "risk_level": "Low" or "Medium" or "High",
        "reasons": [
            "Reason 1 based on technials/fundamentals",
            "Reason 2...",
            "Reason 3..."
        ],
        "is_simulated": false
    }}
    
    Ensure targets and stop losses are numerically logical based on the current price. Return ONLY the raw JSON block without markdown code fences.
    """
    
    # Try Gemini
    if has_gemini:
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt)
            text = response.text.strip()
            # Clean possible markdown block markers
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            res = json.loads(text.strip())
            res["is_simulated"] = False
            return res
        except Exception as e:
            print(f"Gemini API execution failed, falling back: {e}")
            
    # Try OpenAI
    if has_openai:
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2
            )
            text = response.choices[0].message.content.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.endswith("```"):
                text = text[:-3]
            res = json.loads(text.strip())
            res["is_simulated"] = False
            return res
        except Exception as e:
            print(f"OpenAI API execution failed, falling back: {e}")
            
    # Fallback to rules engine if no API keys or errors
    return get_rule_based_recommendation(ticker, price, tech_analysis, profile)

def generate_simulator_chat_response(query: str, portfolio: list = None) -> str:
    """
    Rule-based interactive agent responses for Simulator Mode.
    Simulates a highly qualified analyst chat responding to standard investor queries.
    """
    query = query.lower()
    
    # 1. Specific Stock Buy/Sell queries
    for ticker, info in data_fetcher.STOCK_PROFILES.items():
        if ticker.lower() in query:
            price = info["current_price"]
            pe = info["pe_ratio"]
            div = info["div_yield"]
            
            # Formulate recommendation
            if "sell" in query:
                return (
                    f"### Analyst Assessment for selling **{ticker}** ({info['name']}):\n\n"
                    f"**{ticker}** is currently trading at around **PKR {price}** (P/E of {pe}x).\n\n"
                    f"**Hold/Sell Rationale:**\n"
                    f"- If you are holding **{ticker}** for **dividends** ({div}% yield), it remains a strong holding. "
                    f"Selling now would mean sacrificing consistent payouts, particularly since interest rates and industry margins are stabilizing.\n"
                    f"- *Short-term trading:* If you have met your targets (around 8-10% capital gain), taking partial profit is sensible, "
                    f"as momentum indicators suggest mild consolidation ahead. However, a complete exit is not recommended unless technical support is broken."
                )
            elif "buy" in query or "should i" in query or "analyze" in query or "opinion" in query:
                return (
                    f"### Investment Analysis: **{ticker}** ({info['name']})\n\n"
                    f"- **Current Valuation:** PKR {price} | P/E: {pe}x | Dividend Yield: {div}%\n"
                    f"- **Sector:** {info['sector']}\n\n"
                    f"**Key Insights:**\n"
                    f"1. **Fundamentals:** {info['description']}\n"
                    f"2. **Recent News:** {info['recent_news'][0]['title']} ({info['recent_news'][0]['source']}).\n"
                    f"3. **Recommendation Summary:** We advise a gradual accumulation at support levels. "
                    f"The technical setup indicates the stock is preparing for a breakout, backed by solid financial statements and volume expansion."
                )

    # 2. Portfolio compilation query
    if "dividend portfolio" in query:
        return (
            "### Recommended PSX High-Yield Dividend Portfolio\n\n"
            "To build a robust income portfolio, we select companies with strong cash flows, low debt-to-equity, and high dividend payouts:\n\n"
            "| Ticker | Company Name | Sector | Div. Yield | Recommended Weight |\n"
            "| :--- | :--- | :--- | :--- | :--- |\n"
            "| **UBL** | United Bank Limited | Commercial Banks | 15.7% | **30%** |\n"
            "| **EFERT** | Engro Fertilizers Limited | Fertilizer | 14.8% | **25%** |\n"
            "| **FFC** | Fauji Fertilizer Company | Fertilizer | 14.1% | **25%** |\n"
            "| **ENGRO** | Engro Corporation Limited | Conglomerates | 12.7% | **20%** |\n\n"
            "**Portfolio Highlights:**\n"
            "- **Average Dividend Yield:** ~14.3%\n"
            "- **Risk Profile:** Low-to-Medium (Defensive sectors)\n"
            "- **Strategy:** Reinvest dividends during price consolidations to compound returns. These sectors act as excellent inflation hedges in Pakistan."
        )

    # 3. Macro question: Interest rates impact
    if "interest rate" in query or "monetary policy" in query or "lower rate" in query:
        return (
            "### Macro Analysis: Impact of Lower Interest Rates on PSX Sectors\n\n"
            "A reduction in the State Bank of Pakistan (SBP) policy rate has a profound impact across sectors:\n\n"
            "1. **Winners (Highly Leveraged & Cyclical Sectors):**\n"
            "   - **Cement (LUCK, DGKC):** Cement manufacturers have high debt-servicing costs. Lower rates directly boost bottom-line margins. Construction demand also expands.\n"
            "   - **Steel & Engineering:** Direct reduction in financial finance charges.\n"
            "   - **Textiles & Autos:** Boosts consumer financing and lowers working capital costs.\n\n"
            "2. **Losers (Commercial Banks):**\n"
            "   - **Banks (UBL, HBL):** Bank margins (Net Interest Margins - NIMs) contract as yields on government securities (T-Bills, PIBs) decline. High-yield banking stocks might see short-term profit-taking.\n\n"
            "**Strategic Advice:** Shift allocation from heavy banking positions toward high-quality Cement (like **LUCK**) and consumer-cyclicals to capture the expansionary cycle."
        )

    # 4. Sector comparison: Undervalued cement
    if "cement" in query or "undervalued" in query:
        return (
            "### Sector Screening: Cement Sector Analysis (LUCK vs. DGKC)\n\n"
            "The cement sector is currently in a transition phase. Here is a comparative valuation:\n\n"
            "- **Lucky Cement (LUCK):**\n"
            "  - *Valuation:* PKR 780.0 | P/E: 5.9x | ROE: 17.5% | P/B: 1.1x\n"
            "  - *Pros:* Highly diversified (KIA Motors, power generation), net-cash balance sheet, export capability. Outstanding operational efficiency.\n\n"
            "- **D.G. Khan Cement (DGKC):**\n"
            "  - *Valuation:* PKR 72.5 | P/E: 12.4x | ROE: 5.2% | P/B: 0.4x\n"
            "  - *Pros:* Trading at a deep 60% discount to book value (P/B 0.4). High operational leverage.\n"
            "  - *Cons:* High debt levels make it highly sensitive to finance costs.\n\n"
            "**Verdict:** **LUCK** is the safer, fundamentally superior bet. However, for a high-beta trade playing on interest rate cuts, **DGKC** offers massive tactical upside."
        )

    # 5. Why did a stock fall
    if "why did" in query or "fall today" in query or "fell today" in query:
        # Check if we can identify which stock
        matching_ticker = "the stock"
        for t in data_fetcher.STOCK_PROFILES:
            if t.lower() in query:
                matching_ticker = t
                break
        return (
            f"### Market Commentary: Price Action on **{matching_ticker}**\n\n"
            f"The recent decline in **{matching_ticker}** is primarily attributed to:\n"
            f"1. **Macro Profit-Taking:** The KSE-100 index has hovered near resistance, prompting institutional fund managers to trim positions and lock in gains.\n"
            f"2. **Circular Debt Overhead:** Concerns regarding energy-sector receivables settlement have temporarily dampened sentiments in E&P and Power stocks.\n"
            f"3. **FBR Tax Audits:** Rumors of tax structures adjustments on corporate cash holdings in the upcoming mini-budget have induced cautious volumes.\n\n"
            f"*Recommendation:* The long-term structural bull run remains intact. Treat these corrections as accumulation windows."
        )

    # 6. Analyze my portfolio query
    if "portfolio" in query:
        portfolio_summary = ""
        if portfolio and len(portfolio) > 0:
            portfolio_summary = "Based on your current holdings:\n\n"
            total_val = 0
            for item in portfolio:
                ticker = item.get("ticker", "").upper()
                shares = item.get("shares", 0)
                price = data_fetcher.STOCK_PROFILES.get(ticker, {}).get("current_price", 100.0)
                val = shares * price
                total_val += val
                portfolio_summary += f"- **{ticker}**: {shares} shares worth **PKR {val:,.2f}**\n"
            portfolio_summary += f"\n**Total Portfolio Value:** PKR {total_val:,.2f}\n\n"
        else:
            portfolio_summary = (
                "You haven't simulated a portfolio yet. You can add stocks like **MARI**, **SYS**, or **UBL** to your portfolio tracker on the right side of the dashboard.\n\n"
            )
            
        return (
            f"### Portfolio Risk & Diversification Report\n\n"
            f"{portfolio_summary}"
            f"**Portfolio Diagnostics:**\n"
            f"- **Sector Concentration:** Check if you are overly exposed to fertilizer or banking (diversification lowers risk).\n"
            f"- **Dividend Yield Projection:** Focus on stocks like **FFC** or **UBL** if you require regular cash-inflows.\n"
            f"- **Growth Drivers:** Keep **SYS** or **MARI** as growth engines to compound asset value.\n\n"
            f"Need specific shifts? Let me know which stock you want to swap!"
        )

    # General Fallback
    return (
        "### Pakistan Stock Exchange AI Advisory Assistant\n\n"
        "I can help you analyze PSX stocks, suggest portfolio allocations, or explain market moves. "
        "Try asking me questions like:\n"
        "- *Should I sell MARI?*\n"
        "- *Build me a dividend portfolio.*\n"
        "- *Why did SYS fall today?*\n"
        "- *Find undervalued cement companies.*\n"
        "- *Which stocks benefit from lower interest rates?*"
    )

def get_portfolio_recommendation(portfolio_summary: dict) -> dict:
    """
    Evaluates the simulated portfolio and returns an AI recommendation report.
    """
    # Try Gemini
    if has_gemini:
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            prompt = f"""
            You are a premier quantitative financial analyst and portfolio manager advising a retail investor on their Pakistan Stock Exchange (PSX) portfolio.
            Analyze the following portfolio summary details and return a structured JSON response evaluating its risk, performance, diversification, and actionable rebalancing.
            
            Portfolio Summary JSON:
            {json.dumps(portfolio_summary, indent=2)}
            
            Format your response in this exact JSON structure:
            {{
                "health_score": <an integer between 10 and 100 based on diversification, quality, and risk>,
                "diversification_rating": "Well Diversified" or "Moderate Concentration" or "High Concentration",
                "analysis_bullets": [
                    "Bullet 1: Evaluation of sector allocation and risk factors",
                    "Bullet 2: Evaluation of returns (P&L) and stock quality",
                    "Bullet 3: Analysis of yield or volatility exposure"
                ],
                "rebalancing_actions": [
                    "Suggestion 1: Sell or reduce [Ticker] to lower exposure if concentration is high",
                    "Suggestion 2: Buy or allocate to [Ticker] to capture growth or yield",
                    "Suggestion 3: Strategic entry target/cash hedge allocation advice"
                ]
            }}
            
            Provide ONLY the raw JSON block without markdown code fences.
            """
            response = model.generate_content(prompt)
            res_text = response.text.strip()
            if res_text.startswith("```"):
                res_text = res_text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
            return json.loads(res_text)
        except Exception as e:
            print(f"Gemini portfolio diagnostics failed: {e}")
            
    # Try OpenAI
    if has_openai:
        try:
            prompt = f"""
            You are a premier quantitative financial analyst and portfolio manager advising a retail investor on their Pakistan Stock Exchange (PSX) portfolio.
            Analyze the following portfolio summary details and return a structured JSON response evaluating its risk, performance, diversification, and actionable rebalancing.
            
            Portfolio Summary JSON:
            {json.dumps(portfolio_summary, indent=2)}
            
            Format your response in this exact JSON structure:
            {{
                "health_score": <an integer between 10 and 100>,
                "diversification_rating": "Well Diversified" or "Moderate Concentration" or "High Concentration",
                "analysis_bullets": [
                    "Bullet 1...",
                    "Bullet 2...",
                    "Bullet 3..."
                ],
                "rebalancing_actions": [
                    "Suggestion 1...",
                    "Suggestion 2...",
                    "Suggestion 3..."
                ]
            }}
            
            Provide ONLY the raw JSON block without markdown code fences.
            """
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a professional financial advisor. Return only valid raw JSON."},
                    {"role": "user", "content": prompt}
                ]
            )
            res_text = response.choices[0].message.content.strip()
            if res_text.startswith("```"):
                res_text = res_text.split("\n", 1)[1].rsplit("\n", 1)[0].strip()
            return json.loads(res_text)
        except Exception as e:
            print(f"OpenAI portfolio diagnostics failed: {e}")
            
    # Fallback to rules-based simulator
    holdings_count = len(portfolio_summary.get("holdings", []))
    if holdings_count >= 5:
        div_rating = "Well Diversified"
        div_score = 90
    elif holdings_count >= 3:
        div_rating = "Moderate Concentration"
        div_score = 75
    else:
        div_rating = "High Concentration"
        div_score = 55
        
    has_heavy_sector = False
    for sector, weight in portfolio_summary.get("sector_allocation", {}).items():
        if weight > 50:
            has_heavy_sector = True
            
    pnl = portfolio_summary.get("total_pnl", 0.0)
    
    score = div_score
    if pnl > 0:
        score += 10
    if has_heavy_sector:
        score -= 15
        
    score = max(10, min(100, score))
    
    bullets = [
        f"Portfolio contains {holdings_count} active holdings across {len(portfolio_summary.get('sector_allocation', {}))} sector(s).",
        f"Your current return stance is {'positive' if pnl >= 0 else 'negative'} with a net return of Rs. {pnl:,.1f} ({portfolio_summary.get('total_pnl_percent')}%)."
    ]
    if has_heavy_sector:
        bullets.append("WARNING: High sector concentration detected (>50% in a single area), exposing you to focused sector shocks.")
    else:
        bullets.append("Good sector allocation balance. Volatility risk is spread across multiple industry segments.")
        
    actions = [
        "Maintain cash reserves of 10-15% to take advantage of buying dips on high-quality stocks like MARI or MEBL.",
        "Consider reinvesting dividend gains to leverage the power of compound interest."
    ]
    if has_heavy_sector:
        actions.insert(0, "Reduce weighting in your highly concentrated sectors and redistribute funds into defensive sectors (like Commercial Banks or Fertilizers).")
    else:
        actions.insert(0, "No urgent rebalancing needed. Continue monitoring quarterly earnings announcements for any fundamental change.")
        
    return {
        "health_score": score,
        "diversification_rating": div_rating,
        "analysis_bullets": bullets,
        "rebalancing_actions": actions
    }

def query_chat_advisor(query: str, ticker_context: str = None, portfolio: list = None) -> str:
    """
    Main entry point for chat queries.
    Uses LLM client if configured, otherwise falls back to rule-based parser.
    """
    # Try Gemini Chat
    if has_gemini:
        try:
            import google.generativeai as genai
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            # Enrich prompt with context
            context = f"Context: User is analyzing stock: {ticker_context}. " if ticker_context else ""
            if portfolio:
                context += f"User's current simulated portfolio: {json.dumps(portfolio)}. "
                
            prompt = (
                f"You are a professional financial advisor for the Pakistan Stock Exchange (PSX).\n"
                f"{context}\n"
                f"User asks: '{query}'\n\n"
                f"Provide a clear, detailed, professional answer in markdown. Mention tickers, numbers, "
                f"and structural arguments (inflation, interest rates, earnings) where relevant."
            )
            response = model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini chat failed, falling back: {e}")
            
    # Try OpenAI Chat
    if has_openai:
        try:
            context = f"Context: User is analyzing stock: {ticker_context}. " if ticker_context else ""
            if portfolio:
                context += f"User's current simulated portfolio: {json.dumps(portfolio)}. "
                
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a professional financial advisor for the Pakistan Stock Exchange (PSX). Provide detailed, structured, markdown responses."},
                    {"role": "user", "content": f"{context}User asks: {query}"}
                ]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"OpenAI chat failed, falling back: {e}")
            
    # Fallback to rules simulator
    return generate_simulator_chat_response(query, portfolio)
