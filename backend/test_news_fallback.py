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


if __name__ == "__main__":
    unittest.main()
