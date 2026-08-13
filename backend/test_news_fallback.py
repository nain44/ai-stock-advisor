import unittest
from unittest.mock import patch
from datetime import datetime, timedelta

import pandas as pd

from data_fetcher import (
    fetch_market_news,
    generate_historical_data,
    get_yahoo_quote,
    get_latest_quote,
    MARKET_NEWS_CACHE,
    QUOTE_CACHE,
    STATIC_PROFILE_CACHE,
)


class NewsFallbackTests(unittest.TestCase):
    def setUp(self):
        MARKET_NEWS_CACHE.clear()
        QUOTE_CACHE.clear()
        STATIC_PROFILE_CACHE.clear()

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
            with patch("data_fetcher.get_yahoo_quote", return_value=None):
                with patch("data_fetcher.psxdata.stocks", return_value=pd.DataFrame()):
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

    def test_pk_uses_yahoo_fallback_when_psx_quote_fails(self):
        yahoo_quote = {
            "ticker": "MEBL.KA",
            "name": "Meezan Bank Limited",
            "sector": "Financial Services",
            "price": 589.25,
            "change": 4.75,
            "pct_change": "0.81%",
            "is_up": True,
            "volume": 600000,
            "high": 592.0,
            "low": 581.4,
            "ldcp": 584.5,
            "pe": 6.2,
            "pb_ratio": 2.1,
            "debt_equity": 0.0,
            "roe": 48.2,
            "div_yield": 7.4,
            "description": "PK listed bank",
            "eps": 35.5,
            "news": [],
            "timestamp": "10:00:00 AM",
        }

        with patch("data_fetcher.psxdata.quote", side_effect=Exception("psx down")):
            with patch("data_fetcher.get_yahoo_quote", return_value=yahoo_quote) as yahoo_mock:
                with patch("data_fetcher.psxdata.stocks", return_value=pd.DataFrame()):
                    quote = get_latest_quote("MEBL", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["ticker"], "MEBL")
        self.assertEqual(quote["price"], 589.25)
        self.assertTrue(quote.get("is_live", False))
        self.assertEqual(quote.get("source"), "yahoo_pk_fallback")
        yahoo_mock.assert_called_once_with("MEBL.KA")

    def test_pk_prefers_psx_history_before_yahoo_fallback(self):
        today_str = datetime.now().strftime("%Y-%m-%d")
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        hist_df = pd.DataFrame([
            {"date": yesterday_str, "close": 583.1},
            {"date": today_str, "close": 591.13},
        ])

        yahoo_quote = {
            "ticker": "MEBL.KA",
            "name": "Meezan Bank Limited",
            "sector": "Financial Services",
            "price": 599.61,
            "change": 0.0,
            "pct_change": "0.0%",
            "is_up": True,
            "volume": 600000,
            "high": 602.0,
            "low": 590.0,
            "ldcp": 599.0,
            "pe": 6.2,
            "pb_ratio": 2.1,
            "debt_equity": 0.0,
            "roe": 48.2,
            "div_yield": 7.4,
            "description": "PK listed bank",
            "eps": 35.5,
            "news": [],
            "timestamp": "10:00:00 AM",
        }

        with patch("data_fetcher.psxdata.quote", side_effect=Exception("psx down")):
            with patch("data_fetcher.psxdata.stocks", return_value=hist_df):
                with patch("data_fetcher.get_yahoo_quote", return_value=yahoo_quote) as yahoo_mock:
                    quote = get_latest_quote("MEBL", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["price"], 591.13)
        self.assertEqual(quote["source"], "psx_history_fallback")
        yahoo_mock.assert_not_called()

    def test_pk_uses_psx_history_fallback_when_quote_and_yahoo_fail(self):
        today_str = datetime.now().strftime("%Y-%m-%d")
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        hist_df = pd.DataFrame([
            {"date": yesterday_str, "close": 583.1},
            {"date": today_str, "close": 589.25},
        ])

        with patch("data_fetcher.psxdata.quote", side_effect=Exception("psx quote down")):
            with patch("data_fetcher.get_yahoo_quote", return_value=None):
                with patch("data_fetcher.psxdata.stocks", return_value=hist_df):
                    quote = get_latest_quote("MEBL", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["ticker"], "MEBL")
        self.assertEqual(quote["price"], 589.25)
        self.assertEqual(quote["ldcp"], 583.1)
        self.assertEqual(quote["source"], "psx_history_fallback")
        self.assertTrue(quote.get("is_live", False))

    def test_pk_history_fallback_marked_delayed_when_not_from_today(self):
        # Skip this check on weekends since Friday's close is still the
        # correct "latest" price and should not be flagged as delayed.
        if datetime.now().weekday() >= 5:
            self.skipTest("Not applicable on weekends")

        stale_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
        hist_df = pd.DataFrame([
            {"date": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"), "close": 583.1},
            {"date": stale_date, "close": 589.25},
        ])

        with patch("data_fetcher.psxdata.quote", side_effect=Exception("psx quote down")):
            with patch("data_fetcher.get_yahoo_quote", return_value=None):
                with patch("data_fetcher.psxdata.stocks", return_value=hist_df):
                    quote = get_latest_quote("MEBL", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["price"], 589.25)
        self.assertEqual(quote["price_date"], stale_date)
        self.assertEqual(quote["source"], "psx_history_fallback_delayed")
        self.assertFalse(quote.get("is_live", True))

    def test_pk_cached_fallback_is_refreshed_when_psx_quote_recovers(self):
        QUOTE_CACHE["PK:MEBL"] = (
            datetime.now(),
            {
                "ticker": "MEBL",
                "price": 599.61,
                "source": "yahoo_pk_fallback",
                "is_live": True,
            },
        )

        live_df = pd.DataFrame([
            {
                "price": 591.13,
                "change_pct": -1.41,
                "volume_avg_30d": 1500000,
                "pe_ratio": 6.2,
                "dividend_yield": 7.4,
                "sector": "Commercial Banks",
            }
        ])

        with patch("data_fetcher.psxdata.quote", return_value=live_df):
            quote = get_latest_quote("MEBL", market="PK")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["price"], 591.13)
        self.assertEqual(quote["source"], "live")

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

    def test_yahoo_dividend_yield_not_overscaled_when_already_percent(self):
        fake_history = pd.DataFrame([
            {"Close": 293.12, "High": 294.0, "Low": 292.1, "Volume": 500000},
            {"Close": 296.61, "High": 296.7, "Low": 292.51, "Volume": 517912},
        ])

        class FakeTicker:
            def __init__(self):
                self.info = {
                    "symbol": "RY.TO",
                    "longName": "Royal Bank of Canada",
                    "sector": "Financial Services",
                    "trailingPE": 19.27,
                    "priceToBook": 3.18,
                    "debtToEquity": 0.0,
                    "returnOnEquity": 0.162,
                    "dividendYield": 2.39,
                    "trailingEps": 15.39,
                }
                self.news = []

            def history(self, period="5d"):
                return fake_history

        with patch("data_fetcher.yf.Ticker", return_value=FakeTicker()):
            quote = get_yahoo_quote("RY.TO")

        self.assertIsNotNone(quote)
        self.assertEqual(quote["ticker"], "RY.TO")
        self.assertEqual(quote["div_yield"], 2.39)

    def test_cached_legacy_overscaled_dividend_yield_is_sanitized(self):
        fake_history = pd.DataFrame([
            {"Close": 293.12, "High": 294.0, "Low": 292.1, "Volume": 500000},
            {"Close": 296.61, "High": 296.7, "Low": 292.51, "Volume": 517912},
        ])

        STATIC_PROFILE_CACHE["RY.TO"] = (
            pd.Timestamp.now(),
            {
                "name": "Royal Bank of Canada",
                "sector": "Financial Services",
                "pe": 19.27,
                "pb_ratio": 3.18,
                "debt_equity": 0.0,
                "roe": 16.2,
                "div_yield": 239.0,
                "description": "Cached profile",
                "eps": 15.39,
            },
        )

        class FakeTicker:
            def __init__(self):
                self.info = {"symbol": "RY.TO"}
                self.news = []

            def history(self, period="5d"):
                return fake_history

        with patch("data_fetcher.yf.Ticker", return_value=FakeTicker()):
            quote = get_yahoo_quote("RY.TO")

        self.assertEqual(quote["div_yield"], 2.39)

    def test_yahoo_sub_one_dividend_yield_percent_not_overscaled(self):
        fake_history = pd.DataFrame([
            {"Close": 300.0, "High": 303.0, "Low": 299.5, "Volume": 800000},
            {"Close": 302.14, "High": 304.0, "Low": 301.2, "Volume": 850000},
        ])

        class FakeTicker:
            def __init__(self):
                self.info = {
                    "symbol": "AAPL",
                    "longName": "Apple Inc.",
                    "sector": "Technology",
                    "trailingPE": 28.0,
                    "priceToBook": 40.0,
                    "debtToEquity": 150.0,
                    "returnOnEquity": 1.0,
                    "dividendYield": 0.35,
                    "dividendRate": 1.04,
                    "trailingEps": 10.0,
                }
                self.news = []

            def history(self, period="5d"):
                return fake_history

        with patch("data_fetcher.yf.Ticker", return_value=FakeTicker()):
            quote = get_yahoo_quote("AAPL")

        self.assertEqual(quote["div_yield"], 0.35)


if __name__ == "__main__":
    unittest.main()
