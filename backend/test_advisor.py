# Backend verification script for AI Stock Advisor
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import data_fetcher
import technical_analysis
import ai_advisor

def run_tests():
    print("=== Testing Data Fetching ===")
    stocks = data_fetcher.get_available_stocks()
    print(f"Available stocks coverage: {len(stocks)} symbols.")
    assert len(stocks) > 0, "No stocks loaded!"
    
    mari_profile = data_fetcher.get_stock_profile("MARI")
    print(f"MARI Profile Loaded: {mari_profile['name']} - Current Price: PKR {mari_profile['current_price']}")
    
    print("\n=== Testing Historical Data Generation ===")
    df = data_fetcher.generate_historical_data("MARI", days=100)
    print(f"Generated {len(df)} days of historical OHLCV data for MARI.")
    print("Latest 3 records:")
    print(df.tail(3))
    assert not df.empty, "Historical data is empty!"
    
    print("\n=== Testing Technical Indicators Calculations ===")
    tech = technical_analysis.run_full_technical_analysis(df)
    print(f"RSI Value: {tech['rsi']['value']} (Status: {tech['rsi']['status']})")
    print(f"MACD Line: {tech['macd']['line']}, Signal: {tech['macd']['signal']}, Crossover: {tech['macd']['crossover']}")
    print(f"Bollinger Bands Mid: {tech['bollinger_bands']['middle']}, Upper: {tech['bollinger_bands']['upper']}, Lower: {tech['bollinger_bands']['lower']}")
    print(f"Volume Ratio: {tech['volume']['ratio']} (Status: {tech['volume']['status']})")
    
    print("\n=== Testing AI Recommendation System (Simulator Mode) ===")
    rec = ai_advisor.get_llm_recommendation("MARI", mari_profile["current_price"], tech, mari_profile)
    print(f"Recommendation: {rec['recommendation']}")
    print(f"Entry Target: {rec['entry']}")
    print(f"Targets: {rec['target1']} & {rec['target2']}")
    print(f"Stop Loss: {rec['stop_loss']}")
    print(f"Confidence: {rec['confidence']}, Risk Level: {rec['risk_level']}")
    print("Rationale Reasons:")
    for r in rec["reasons"]:
        print(f" - {r}")
        
    print("\n=== Testing AI Chatbot (Simulator Mode) ===")
    queries = [
        "Should I buy MARI?",
        "Build me a dividend portfolio.",
        "Which stocks benefit from lower interest rates?",
        "Find undervalued cement companies.",
        "Why did SYS fall today?"
    ]
    for q in queries:
        print(f"\nQuery: '{q}'")
        resp = ai_advisor.query_chat_advisor(q, ticker_context="MARI")
        # Print first few lines of response
        lines = resp.split("\n")
        print("\n".join(lines[:4]) + ("\n..." if len(lines) > 4 else ""))

    print("\n===============================")
    print("ALL TESTS COMPLETED SUCCESSFULLY!")
    print("===============================")

if __name__ == "__main__":
    run_tests()
