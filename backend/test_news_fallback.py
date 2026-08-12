import unittest
from unittest.mock import patch

import pandas as pd

from data_fetcher import (
    fetch_market_news,
    generate_historical_data,
    get_latest_quote,
    MARKET_NEWS_CACHE,
    QUOTE_CACHE,
)


class NewsFallbackTests(unittest.TestCase):
    def setUp(self):
        MARKET_NEWS_CACHE.clear()
        QUOTE_CACHE.clear()

    def test_returns_fallback_news_when_live_feed_is_empty(self):
        class EmptyResponse:
            status_code = 200
            content = b"<rss><channel></channel></rss>"

        with patch("httpx.get", return_value=EmptyResponse()):
            news = fetch_market_news("PK")

        self.assertTrue(news, "fallback news should be returned when feed is empty")
        self.assertTrue(all(item.get("title") for item in news))

    def test_uses_local_google_news_when_yahoo_feed_is_empty(self):
        class EmptyResponse:
            status_code = 200
            content = b"<rss><channel></channel></rss>"

        class GoogleNewsResponse:
            status_code = 200
            content = b"""<rss><channel><item><title>PSX gains as investors watch local earnings</title><link>https://example.com/local-news</link><pubDate>Mon, 10 Aug 2026 18:03:42 GMT</pubDate></item></channel></rss>"""

        with patch("httpx.get", side_effect=[EmptyResponse(), GoogleNewsResponse(), EmptyResponse(), EmptyResponse(), EmptyResponse()]):
            news = fetch_market_news("PK")

        self.assertTrue(news)
        self.assertTrue(any(item.get("source") == "Google News" for item in news))
        self.assertTrue(any("PSX" in item.get("title", "") for item in news))

    def test_filters_out_news_older_than_three_days_even_with_iso_dates(self):
        class FeedResponse:
            status_code = 200
            content = b"""<rss><channel><item><title>Old headline</title><link>https://example.com/old</link><pubDate>2026-08-01T10:00:00Z</pubDate></item><item><title>Recent headline</title><link>https://example.com/new</link><pubDate>2026-08-10T10:00:00Z</pubDate></item></channel></rss>"""

        with patch("httpx.get", return_value=FeedResponse()):
            news = fetch_market_news("PK")

        self.assertTrue(news)
        self.assertTrue(all("old headline" not in item.get("title", "").lower() for item in news))
        self.assertTrue(any("recent headline" in item.get("title", "").lower() for item in news))

    def test_prefers_live_psx_quote_over_profile_fallback(self):
        with patch("data_fetcher.psxdata.quote", return_value=pd.DataFrame([{
            "price": 725.0,
            "change_pct": 1.25,
            "volume_avg_30d": 300000,
            "pe_ratio": 8.2,
            "dividend_yield": 6.4,
            "sector": "Oil & Gas Exploration",
        }])):
            with patch("data_fetcher.get_stock_profile", return_value={
                "name": "Mari Petroleum Company Limited",
                "sector": "Oil & Gas Exploration",
                "current_price": 710.0,
                "pe_ratio": 7.8,
                "roe": 44.5,
                "div_yield": 6.8,
                "recent_news": [{"title": "Mari announces updated guidance", "source": "Profile"}],
                "volume_avg": 250000,
            }):
                quote = get_latest_quote("MARI", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["ticker"], "MARI")
        self.assertEqual(quote["price"], 725.0)
        self.assertTrue(quote.get("is_live", False))
        self.assertEqual(quote["source"], "live")

    def test_returns_profile_based_quote_when_live_quote_data_fails(self):
        with patch("data_fetcher.psxdata.quote", side_effect=Exception("quote unavailable")):
            with patch("data_fetcher.get_stock_profile", return_value={
                "name": "Mari Petroleum Company Limited",
                "sector": "Oil & Gas Exploration",
                "current_price": 710.0,
                "pe_ratio": 7.8,
                "roe": 44.5,
                "div_yield": 6.8,
                "recent_news": [{"title": "Mari announces updated guidance", "source": "Profile"}],
                "volume_avg": 250000,
            }):
                quote = get_latest_quote("MARI", market="PK")

        self.assertIsNotNone(quote, "quote should fall back to a profile-based payload when live data is unavailable")
        self.assertEqual(quote["ticker"], "MARI")
        self.assertEqual(quote["price"], 710.0)
        self.assertFalse(quote.get("is_live", True))
        self.assertEqual(quote["source"], "profile")

    def test_non_pk_quote_uses_yahoo_pipeline(self):
        yahoo_quote = {
            "ticker": "RY.TO",
            "name": "Royal Bank of Canada",
            "sector": "Financial Services",
            "price": 140.25,
            "change": 0.8,
            "pct_change": "0.57%",
            "is_up": True,
            "volume": 1000000,
            "high": 141.0,
            "low": 139.7,
            "ldcp": 139.45,
            "pe": 12.3,
            "pb_ratio": 1.7,
            "debt_equity": 0.0,
            "roe": 14.2,
            "div_yield": 3.8,
            "description": "A listed stock on the TSX.",
            "eps": 11.4,
            "news": [],
            "timestamp": "10:00:00 AM",
        }

        with patch("data_fetcher.get_yahoo_quote", return_value=yahoo_quote) as yahoo_mock:
            with patch("data_fetcher.psxdata.quote") as psx_mock:
                quote = get_latest_quote("RY", market="CA")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["ticker"], "RY.TO")
        self.assertEqual(quote["price"], 140.25)
        yahoo_mock.assert_called_once_with("RY.TO")
        psx_mock.assert_not_called()

    def test_non_pk_historical_uses_yahoo_pipeline(self):
        hist = pd.DataFrame([
            {"Date": "2026-08-10", "Open": 139.0, "High": 141.0, "Low": 138.5, "Close": 140.25, "Volume": 1200000}
        ])

        with patch("data_fetcher.get_yahoo_historical", return_value=hist) as yahoo_hist_mock:
            with patch("data_fetcher.psxdata.stocks") as psx_stocks_mock:
                df = generate_historical_data("RY", 30, market="CA")

        self.assertFalse(df.empty)
        self.assertEqual(float(df.iloc[-1]["Close"]), 140.25)
        yahoo_hist_mock.assert_called_once_with("RY.TO", 30)
        psx_stocks_mock.assert_not_called()


if __name__ == "__main__":
    unittest.main()
