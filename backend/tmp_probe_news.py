import sys
sys.path.insert(0, r'c:\Users\nain4\.gemini\antigravity-ide\scratch\ai-stock-advisor\backend')
import data_fetcher
from unittest.mock import patch

class EmptyResponse:
    status_code = 200
    content = b'<rss><channel></channel></rss>'

class GoogleNewsResponse:
    status_code = 200
    content = b'<rss><channel><item><title>PSX gains as investors watch local earnings</title><link>https://example.com/local-news</link><pubDate>Mon, 10 Aug 2026 18:03:42 GMT</pubDate></item></channel></rss>'

with patch('httpx.get', side_effect=[EmptyResponse(), GoogleNewsResponse(), EmptyResponse(), EmptyResponse(), EmptyResponse()]):
    news = data_fetcher.fetch_market_news('PK')
    print(news)
