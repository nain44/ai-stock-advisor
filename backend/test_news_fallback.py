import unittest
from unittest.mock import patch

from data_fetcher import fetch_market_news


class NewsFallbackTests(unittest.TestCase):
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

        with patch("httpx.get", side_effect=[EmptyResponse(), GoogleNewsResponse()]):
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


if __name__ == "__main__":
    unittest.main()
