import httpx
try:
    resp = httpx.get("https://psxterminal.com/api/market-data", timeout=10.0)
    print("Status:", resp.status_code)
    print("Content:", resp.text)
except Exception as e:
    print("Error:", e)
