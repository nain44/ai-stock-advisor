import unittest
from unittest.mock import patch

from data_fetcher import fetch_market_news, get_latest_quote, MARKET_NEWS_CACHE


class NewsFallbackTests(unittest.TestCase):
    def setUp(self):
        MARKET_NEWS_CACHE.clear()

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


if __name__ == "__main__":
    unittest.main()
