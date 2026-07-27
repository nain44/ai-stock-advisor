import pandas as pd
import numpy as np

def calculate_sma(df: pd.DataFrame, period: int = 50, column: str = "Close") -> pd.Series:
    """Calculates Simple Moving Average."""
    return df[column].rolling(window=period).mean()

def calculate_ema(df: pd.DataFrame, period: int = 12, column: str = "Close") -> pd.Series:
    """Calculates Exponential Moving Average."""
    return df[column].ewm(span=period, adjust=False).mean()

def calculate_rsi(df: pd.DataFrame, period: int = 14, column: str = "Close") -> pd.Series:
    """Calculates Relative Strength Index (RSI)."""
    delta = df[column].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    # Avoid division by zero
    rs = gain / (loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))
    
    # Fill leading NaNs
    rsi = rsi.fillna(50.0)
    return rsi

def calculate_macd(df: pd.DataFrame, fast_period: int = 12, slow_period: int = 26, signal_period: int = 9, column: str = "Close"):
    """
    Calculates MACD (Moving Average Convergence Divergence) and MACD Signal line.
    """
    fast_ema = calculate_ema(df, fast_period, column)
    slow_ema = calculate_ema(df, slow_period, column)
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
    macd_hist = macd_line - signal_line
    return macd_line, signal_line, macd_hist

def calculate_bollinger_bands(df: pd.DataFrame, period: int = 20, num_std: float = 2.0, column: str = "Close"):
    """Calculates Bollinger Bands (Middle, Upper, Lower bands)."""
    sma = calculate_sma(df, period, column)
    std = df[column].rolling(window=period).std()
    upper_band = sma + (num_std * std)
    lower_band = sma - (num_std * std)
    return sma, upper_band, lower_band

def analyze_volume(df: pd.DataFrame, period: int = 20) -> dict:
    """
    Analyzes volume. Returns average volume and current volume ratio.
    """
    if len(df) < period:
        return {"avg_volume": float(df["Volume"].mean()), "ratio": 1.0, "status": "Neutral"}
        
    latest_volume = float(df["Volume"].iloc[-1])
    avg_volume = float(df["Volume"].rolling(window=period).mean().iloc[-1])
    ratio = latest_volume / (avg_volume + 1e-10)
    
    if ratio > 1.5:
        status = "High Volume (Bullish on green day, Bearish on red day)"
    elif ratio < 0.5:
        status = "Decreasing Volume"
    else:
        status = "Normal Volume"
        
    return {
        "latest_volume": latest_volume,
        "avg_volume": avg_volume,
        "ratio": round(ratio, 2),
        "status": status
    }

def run_full_technical_analysis(df: pd.DataFrame) -> dict:
    """
    Runs all technical indicators and compiles their latest values
    into a structured dictionary.
    """
    # Create a copy to prevent modifications to original df
    df_calc = df.copy()
    
    # Calculate indicators
    df_calc["SMA_50"] = calculate_sma(df_calc, 50)
    df_calc["SMA_200"] = calculate_sma(df_calc, 200)
    df_calc["RSI"] = calculate_rsi(df_calc, 14)
    
    macd_l, macd_s, macd_h = calculate_macd(df_calc)
    df_calc["MACD_Line"] = macd_l
    df_calc["MACD_Signal"] = macd_s
    df_calc["MACD_Hist"] = macd_h
    
    bb_mid, bb_upper, bb_lower = calculate_bollinger_bands(df_calc)
    df_calc["BB_Mid"] = bb_mid
    df_calc["BB_Upper"] = bb_upper
    df_calc["BB_Lower"] = bb_lower
    
    # Extract latest row
    latest = df_calc.iloc[-1]
    prev = df_calc.iloc[-2] if len(df_calc) > 1 else latest
    
    # Volume analysis
    vol_analysis = analyze_volume(df_calc)
    
    # Identify indicators
    rsi_val = float(latest["RSI"])
    rsi_status = "Neutral"
    if rsi_val > 70:
        rsi_status = "Overbought (Bearish potential)"
    elif rsi_val < 30:
        rsi_status = "Oversold (Bullish potential)"
    elif rsi_val > prev["RSI"] and prev["RSI"] < 40:
        rsi_status = "Recovering (Bullish)"
        
    # MACD Crossover detection
    macd_val = float(latest["MACD_Line"])
    macd_sig = float(latest["MACD_Signal"])
    prev_macd_val = float(prev["MACD_Line"])
    prev_macd_sig = float(prev["MACD_Signal"])
    
    macd_crossover = "Neutral"
    if prev_macd_val < prev_macd_sig and macd_val > macd_sig:
        macd_crossover = "Bullish Crossover"
    elif prev_macd_val > prev_macd_sig and macd_val < macd_sig:
        macd_crossover = "Bearish Crossover"
        
    # Price Relative to SMA
    close_price = float(latest["Close"])
    sma_50 = float(latest["SMA_50"]) if not pd.isna(latest["SMA_50"]) else close_price
    sma_200 = float(latest["SMA_200"]) if not pd.isna(latest["SMA_200"]) else close_price
    
    sma_50_status = "Above" if close_price > sma_50 else "Below"
    sma_200_status = "Above" if close_price > sma_200 else "Below"
    
    # Bollinger Bands position
    bb_upper_val = float(latest["BB_Upper"]) if not pd.isna(latest["BB_Upper"]) else close_price
    bb_lower_val = float(latest["BB_Lower"]) if not pd.isna(latest["BB_Lower"]) else close_price
    
    bb_status = "Neutral"
    if close_price > bb_upper_val:
        bb_status = "Above Upper Band (Overextended/Overbought)"
    elif close_price < bb_lower_val:
        bb_status = "Below Lower Band (Oversold)"
        
    return {
        "current_price": round(close_price, 2),
        "rsi": {
            "value": round(rsi_val, 2),
            "status": rsi_status
        },
        "macd": {
            "line": round(macd_val, 4),
            "signal": round(macd_sig, 4),
            "histogram": round(float(latest["MACD_Hist"]), 4),
            "crossover": macd_crossover
        },
        "moving_averages": {
            "sma_50": round(sma_50, 2),
            "sma_50_status": sma_50_status,
            "sma_200": round(sma_200, 2),
            "sma_200_status": sma_200_status
        },
        "bollinger_bands": {
            "upper": round(bb_upper_val, 2),
            "middle": round(float(latest["BB_Mid"]), 2) if not pd.isna(latest["BB_Mid"]) else close_price,
            "lower": round(bb_lower_val, 2),
            "status": bb_status
        },
        "volume": vol_analysis
    }
