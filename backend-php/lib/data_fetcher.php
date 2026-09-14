<?php
/**
 * Ported from backend/data_fetcher.py.
 *
 * NOTE: This module intentionally does NOT fetch or redistribute real
 * exchange market data (e.g. a live PSX/broker feed). PSX's published
 * data-licensing notice prohibits dissemination of its market data feed
 * (prices, bids/asks, volumes, index levels) through applications
 * without a license. All prices/volumes below are synthetically
 * generated for demonstration purposes only.
 *
 * Divergence from the Python version: the Python backend keeps its quote
 * cache (QUOTE_CACHE), market-news cache and ticker-news cache as
 * in-process dicts that live for as long as the uvicorn worker runs.
 * Plain PHP on shared hosting has no long-running process, so those
 * caches are backed here by small JSON files under backend-php/cache/
 * (see lib/helpers.php's cache_get/cache_set) with the same TTLs.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/stock_profiles.php';

/**
 * Returns a profile for the simulation engine to seed a price series from.
 * Uses the curated stock_profiles() for known PK tickers; otherwise derives
 * a deterministic (ticker+market-seeded, so stable across calls) placeholder
 * profile for any other ticker/market. None of this reflects real market values.
 */
function get_or_create_mock_profile(string $ticker, string $market = 'PK'): array
{
    $ticker = strtoupper($ticker);
    $profile = get_stock_profile($ticker);
    if ($profile) {
        return $profile;
    }

    $seed = seed_from_string(strtoupper($market) . ':' . $ticker);
    mt_srand($seed);

    $basePrice = round(rng_uniform(20, 500), 2);
    return [
        'name' => "$ticker (" . strtoupper($market) . ')',
        'sector' => strtoupper($market) . ' Equity (Simulated)',
        'current_price' => $basePrice,
        'pe_ratio' => round(rng_uniform(6, 30), 1),
        'roe' => round(rng_uniform(5, 35), 1),
        'div_yield' => round(rng_uniform(0, 6), 1),
        'debt_equity' => round(rng_uniform(0, 80), 1),
        'pb_ratio' => round(rng_uniform(0.8, 6), 1),
        'eps' => round($basePrice / rng_uniform(6, 30), 2),
        'volume_avg' => (int)rng_uniform(50000, 1000000),
        'description' => 'Simulated equity for demonstration purposes only — not real market data.',
        'recent_news' => [],
    ];
}

/**
 * Generates simulated historical daily OHLCV candles for a ticker via a
 * ticker-seeded random walk (geometric Brownian motion style), same
 * algorithm shape as _generate_simulated_historical_data in data_fetcher.py.
 * Not real exchange data.
 *
 * @return array<int, array{Date:string,Open:float,High:float,Low:float,Close:float,Volume:int}>
 */
function generate_historical_data(string $ticker, int $days = 120, string $market = 'PK'): array
{
    $ticker = strtoupper($ticker);
    $market = strtoupper($market);
    $profile = get_or_create_mock_profile($ticker, $market);

    $basePrice = (float)$profile['current_price'];
    $avgVol = (float)$profile['volume_avg'];

    // Seed with ticker hash only (matches Python: seed_val = sum(ord(c) for c in ticker))
    $seed = seed_from_string($ticker);
    mt_srand($seed);

    $drift = 0.0003;
    $volatility = 0.015;
    if (in_array($ticker, ['MARI', 'SYS', 'UBL', 'FFC'], true)) {
        $drift = 0.0008;
        $volatility = 0.012;
    } elseif (in_array($ticker, ['DGKC', 'HBL'], true)) {
        $drift = -0.0002;
        $volatility = 0.018;
    }

    $prices = [$basePrice];
    for ($i = 0; $i < $days - 1; $i++) {
        $change = rng_normal(-$drift, $volatility);
        $prevPrice = end($prices) * exp($change);
        $prices[] = max($prevPrice, 1.0);
    }
    $prices = array_reverse($prices);

    $data = [];
    $startDate = new DateTime('now');
    $startDate->modify("-{$days} days");

    foreach ($prices as $i => $price) {
        $currentDate = clone $startDate;
        $currentDate->modify("+{$i} days");

        // Skip weekends (0=Sun..6=Sat in PHP 'w'; ISO 'N' is 1=Mon..7=Sun)
        $isoDow = (int)$currentDate->format('N');
        if ($isoDow >= 6) {
            continue;
        }

        $dailyVol = $price * ($volatility * rng_uniform(0.6, 1.4));

        $close = $price;
        $high = $price + ($dailyVol * rng_uniform(0.1, 0.8));
        $low = $price - ($dailyVol * rng_uniform(0.1, 0.8));
        $openVal = $price + ($dailyVol * rng_uniform(-0.4, 0.4));

        $high = max($high, $openVal, $close);
        $low = min($low, $openVal, $close);

        $volume = (int)($avgVol * rng_uniform(0.4, 2.2));

        $data[] = [
            'Date' => $currentDate->format('Y-m-d'),
            'Open' => round($openVal, 2),
            'High' => round($high, 2),
            'Low' => round($low, 2),
            'Close' => round($close, 2),
            'Volume' => $volume,
        ];
    }

    return $data;
}

/**
 * Generates a simulated quote with minor random intraday-style fluctuations.
 * This is synthetic data for demonstration only, not a real market feed.
 */
function generate_simulated_quote(string $ticker, string $market = 'PK'): array
{
    $ticker = strtoupper($ticker);
    $profile = get_or_create_mock_profile($ticker, $market);

    $price = (float)$profile['current_price'];
    mt_srand(); // fresh randomness on every call so the "market" feels alive

    $pctChange = rng_uniform(-0.015, 0.02);
    $newPrice = round($price * (1 + $pctChange), 2);
    $change = round($newPrice - $price, 2);
    $pctChangeStr = round($pctChange * 100, 2) . '%';

    return [
        'ticker' => $ticker,
        'name' => $profile['name'],
        'sector' => $profile['sector'] ?? 'Simulated Equity',
        'price' => $newPrice,
        'change' => $change,
        'pct_change' => $pctChangeStr,
        'is_up' => $change >= 0,
        'volume' => (int)($profile['volume_avg'] * rng_uniform(0.8, 1.5)),
        'high' => round($newPrice * 1.01, 2),
        'low' => round($newPrice * 0.99, 2),
        'ldcp' => round($price, 2),
        'pe' => $profile['pe_ratio'] ?? 0.0,
        'roe' => $profile['roe'] ?? 0.0,
        'div_yield' => $profile['div_yield'] ?? 0.0,
        'pb_ratio' => $profile['pb_ratio'] ?? 1.0,
        'debt_equity' => $profile['debt_equity'] ?? 0.0,
        'eps' => $profile['eps'] ?? 0.0,
        'description' => $profile['description'] ?? 'Simulated equity for demonstration purposes only.',
        'news' => $profile['recent_news'] ?? [],
        'timestamp' => date('h:i:s A'),
        'source' => 'simulated',
        'is_live' => false,
        'price_date' => null,
    ];
}

/**
 * Returns a simulated quote for the given ticker/market, cached for 2
 * minutes per ticker+market (file cache; see module docblock).
 */
function get_latest_quote(string $ticker, string $market = 'PK'): array
{
    $ticker = strtoupper($ticker);
    $marketUpper = strtoupper($market);
    $cacheKey = "$marketUpper:$ticker";

    $cached = cache_get('quotes', $cacheKey, 120); // 2 minutes
    if ($cached !== null) {
        return $cached;
    }

    $quote = generate_simulated_quote($ticker, $marketUpper);
    cache_set('quotes', $cacheKey, $quote, 300);
    return $quote;
}

/* ---------------------------------------------------------------------
 * News fetching (real RSS feeds — not simulated). Cached 2 min (market
 * news) / 5 min (ticker news) via the file cache.
 * ------------------------------------------------------------------- */

const NEWS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

function market_feed_map(): array
{
    return [
        'US' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC',
        'PK' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC',
        'IN' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ENSEI',
        'UK' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EFTSE',
        'CA' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPTSE',
        'JP' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EN225',
        'DE' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGDAXI',
        'AU' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EAXJO',
        'SA' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5ETadawul',
        'AE' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EADX',
        'CN' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EHSI',
        'QA' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EQLSI',
        'EG' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EEGX30',
        'TR' => 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EBIST100',
    ];
}

function local_query_map(): array
{
    return [
        'PK' => 'PSX OR Pakistan Stock Exchange',
        'US' => 'S&P 500 OR Nasdaq OR US stocks',
        'IN' => 'NSE India OR Nifty OR Indian stocks',
        'UK' => 'FTSE OR London markets',
        'CA' => 'TSX OR Canadian stocks',
        'JP' => 'Nikkei OR Japanese stocks',
        'DE' => 'DAX OR German stocks',
        'AU' => 'ASX OR Australian stocks',
        'SA' => 'Tadawul OR Saudi stocks',
        'AE' => 'ADX OR UAE stocks',
        'CN' => 'Hang Seng OR Chinese markets',
        'QA' => 'Qatar stocks',
        'EG' => 'EGX OR Egyptian stocks',
        'TR' => 'Borsa Istanbul OR Turkish stocks',
    ];
}

function regional_feed_map(): array
{
    return [
        'PK' => ['https://www.dawn.com/news/feed', 'https://www.brecorder.com/feed', 'https://www.thenews.com.pk/rss/1/1'],
        'IN' => ['https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://www.thehindu.com/feeder/default.rss', 'https://www.financialexpress.com/feed/'],
        'US' => ['https://feeds.feedburner.com/Reuters/BusinessNews', 'https://www.wsj.com/xml/rss/3_7014.xml'],
        'UK' => ['https://feeds.feedburner.com/ft/topstories', 'https://www.reutersagency.com/feed/?best-sectors=markets'],
        'CA' => ['https://www.reuters.com/world/americas/canada/rss', 'https://financialpost.com/feed'],
        'JP' => ['https://www.reuters.com/world/asia/japan/rss', 'https://www.nikkei.com/rss/'],
        'DE' => ['https://www.reuters.com/world/europe/germany/rss', 'https://www.handelsblatt.com/rss'],
        'AU' => ['https://www.reuters.com/world/asia-pacific/australia/rss', 'https://www.afr.com/rss'],
        'SA' => ['https://www.reuters.com/world/middle-east/saudi-arabia/rss', 'https://www.arabnews.com/rss'],
        'AE' => ['https://www.reuters.com/world/middle-east/uae/rss', 'https://www.thenationalnews.com/feeds/'],
        'CN' => ['https://www.reuters.com/world/china/rss', 'https://www.scmp.com/rss'],
        'QA' => ['https://www.reuters.com/world/middle-east/qatar/rss', 'https://www.gulf-times.com/rss'],
        'EG' => ['https://www.reuters.com/world/middle-east/egypt/rss', 'https://english.ahram.org.eg/NewsRss.aspx'],
        'TR' => ['https://www.reuters.com/world/middle-east/turkey/rss', 'https://www.dailysabah.com/rss'],
    ];
}

function classify_sentiment(string $title, array $bullishWords, array $bearishWords): string
{
    $lower = strtolower($title);
    foreach ($bullishWords as $w) {
        if (strpos($lower, $w) !== false) {
            return 'bullish';
        }
    }
    foreach ($bearishWords as $w) {
        if (strpos($lower, $w) !== false) {
            return 'bearish';
        }
    }
    return 'neutral';
}

/** Parses an RSS/XML feed body into a list of {title,link,pub_date,source,sentiment}. */
function parse_rss_items(string $xml, string $sourceName, int $limit = 8): array
{
    $items = [];
    $prevSetting = libxml_use_internal_errors(true);
    $root = simplexml_load_string($xml);
    libxml_use_internal_errors($prevSetting);
    if ($root === false) {
        return [];
    }

    $nodes = $root->xpath('//item');
    if (!$nodes) {
        return [];
    }

    $bullish = ['gain', 'bull', 'surge', 'up', 'rise', 'grow', 'jump', 'record high', 'recovery', 'profit'];
    $bearish = ['fall', 'slip', 'bear', 'down', 'drop', 'plunge', 'decline', 'slump', 'loss', 'crash'];

    $count = 0;
    foreach ($nodes as $item) {
        if ($count >= $limit) {
            break;
        }
        $count++;
        $title = (string)($item->title ?? '');
        $link = (string)($item->link ?? '');
        $pubDate = (string)($item->pubDate ?? '');

        if ($title === '') {
            continue;
        }

        $effectiveSource = $sourceName;
        $items[] = [
            'title' => $title,
            'link' => $link,
            'pub_date' => $pubDate,
            'source' => $effectiveSource,
            'sentiment' => classify_sentiment($title, $bullish, $bearish),
        ];
    }
    return $items;
}

/** Fetches market-wide recent financial news from live RSS feeds, falling back to a static blurb. */
function fetch_market_news(string $market = 'PK'): array
{
    $marketUpper = strtoupper($market ?: 'PK');
    $nowGmt = gmdate('D, d M Y H:i:s') . ' GMT';

    $fallback = [
        [
            'title' => "$marketUpper markets are moving on earnings, policy, and macroeconomic developments.",
            'link' => '#',
            'pub_date' => $nowGmt,
            'source' => 'Market Pulse',
            'sentiment' => 'neutral',
        ],
        [
            'title' => "Traders are watching $marketUpper sentiment closely as new data and headlines shape the session.",
            'link' => '#',
            'pub_date' => $nowGmt,
            'source' => 'Market Pulse',
            'sentiment' => 'bullish',
        ],
    ];

    $cached = cache_get('market_news', $marketUpper, 120);
    if ($cached !== null) {
        return $cached;
    }

    $feedMap = market_feed_map();
    $queryMap = local_query_map();
    $regionalMap = regional_feed_map();

    $yahooUrl = $feedMap[$marketUpper] ?? 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC';
    $localQuery = $queryMap[$marketUpper] ?? 'stock market';
    $googleUrl = 'https://news.google.com/rss/search?q=' . rawurlencode($localQuery) . '&hl=en-US&gl=US&ceid=US:en';

    $sources = [['Google News', $googleUrl], ['Yahoo Finance', $yahooUrl]];
    if (isset($regionalMap[$marketUpper])) {
        foreach ($regionalMap[$marketUpper] as $feedUrl) {
            $sources[] = ["Regional Feed $marketUpper", $feedUrl];
        }
    }

    $newsList = [];
    $seenLinks = [];

    foreach ($sources as [$sourceName, $url]) {
        $resp = http_get($url, ["User-Agent: " . NEWS_USER_AGENT], 10.0);
        if (!$resp || $resp['status'] !== 200) {
            continue;
        }
        $effective = $sourceName;
        if (stripos($url, 'news.google.com') !== false || $sourceName === 'Google News') {
            $effective = 'Google News';
        } elseif (stripos($url, 'finance.yahoo.com') !== false || $sourceName === 'Yahoo Finance') {
            $effective = 'Yahoo Finance';
        }
        foreach (parse_rss_items($resp['body'], $effective) as $item) {
            $key = $item['link'] ?: $item['title'];
            if ($key && !isset($seenLinks[$key])) {
                $seenLinks[$key] = true;
                $newsList[] = $item;
            }
            if (count($newsList) >= 10) {
                break;
            }
        }
    }

    if (!empty($newsList)) {
        $lowerQuery = strtolower($localQuery);
        $queryTerms = preg_split('/\s+/', $lowerQuery);

        usort($newsList, function ($a, $b) use ($queryTerms) {
            $rank = function ($item) use ($queryTerms) {
                $title = strtolower($item['title'] ?? '');
                $source = strtolower($item['source'] ?? '');
                $sentiment = $item['sentiment'] ?? 'neutral';
                $sentimentRank = $sentiment === 'bullish' ? 3 : ($sentiment === 'bearish' ? 2 : 1);

                $queryMatch = 0;
                foreach ($queryTerms as $t) {
                    if ($t !== '' && strpos($title, $t) !== false) {
                        $queryMatch = 1;
                        break;
                    }
                }
                if ($queryMatch === 0 && strpos($source, 'google') !== false) {
                    $queryMatch = 1;
                }
                $regionalBonus = (strpos($source, 'regional') !== false || strpos($source, 'google') !== false || strpos($source, 'yahoo') === false) ? 1 : 0;
                return [$sentimentRank, $queryMatch, $regionalBonus];
            };
            $ra = $rank($a);
            $rb = $rank($b);
            // Descending order (reverse=True in Python)
            return $rb <=> $ra;
        });

        $newsList = array_slice($newsList, 0, 10);
        cache_set('market_news', $marketUpper, $newsList, 50);
        return $newsList;
    }

    cache_set('market_news', $marketUpper, $fallback, 50);
    return $fallback;
}

/** Fetches stock-specific news from Yahoo Finance RSS (global markets) or Google News (Pakistan/others). */
function fetch_ticker_news(string $ticker, string $market = 'PK'): array
{
    $tickerUpper = strtoupper($ticker ?: '');
    $marketUpper = strtoupper($market ?: 'PK');
    $cacheKey = "$marketUpper:$tickerUpper";

    $cached = cache_get('ticker_news', $cacheKey, 300);
    if ($cached !== null) {
        return $cached;
    }

    $newsList = [];
    $globalMarkets = ['US', 'IN', 'UK', 'CA', 'JP', 'DE', 'AU', 'SA', 'AE', 'CN', 'QA', 'EG', 'TR'];

    if (in_array($marketUpper, $globalMarkets, true)) {
        $url = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=' . rawurlencode($tickerUpper);
        $resp = http_get($url, ["User-Agent: " . NEWS_USER_AGENT], 10.0);
        if ($resp && $resp['status'] === 200) {
            $bullish = ['buy', 'gain', 'bull', 'surge', 'up', 'rise', 'grow', 'outperform'];
            $bearish = ['sell', 'fall', 'slip', 'bear', 'down', 'drop', 'plunge', 'decline', 'underperform'];
            $prevSetting = libxml_use_internal_errors(true);
            $root = simplexml_load_string($resp['body']);
            libxml_use_internal_errors($prevSetting);
            if ($root !== false) {
                $nodes = $root->xpath('//item');
                $count = 0;
                foreach ($nodes ?: [] as $item) {
                    if ($count >= 8) {
                        break;
                    }
                    $count++;
                    $title = (string)($item->title ?? '');
                    $newsList[] = [
                        'title' => $title,
                        'link' => (string)($item->link ?? ''),
                        'pub_date' => (string)($item->pubDate ?? ''),
                        'source' => 'Yahoo Finance',
                        'sentiment' => classify_sentiment($title, $bullish, $bearish),
                    ];
                }
            }
        }
        if (!empty($newsList)) {
            cache_set('ticker_news', $cacheKey, $newsList, 200);
            return $newsList;
        }
    }

    // Fallback/PK markets: query Google News
    $profile = get_stock_profile($tickerUpper);
    $companyName = $profile['name'] ?? $tickerUpper;

    $cleanName = $companyName;
    foreach (['Limited', 'Ltd', 'Company', 'Corp', 'Corporation', 'Bank'] as $suffix) {
        $suffixLen = strlen($suffix);
        if (substr($cleanName, -$suffixLen) === $suffix) {
            $cleanName = trim(substr($cleanName, 0, -$suffixLen));
            break;
        }
    }

    $query = "\"$cleanName\" stock OR \"$tickerUpper\" PSX";
    if ($marketUpper !== 'PK') {
        $query = "\"$cleanName\" stock OR \"$tickerUpper\"";
    }

    $url = 'https://news.google.com/rss/search?q=' . rawurlencode($query) . '&hl=en-US&gl=US&ceid=US:en';
    $resp = http_get($url, ["User-Agent: " . NEWS_USER_AGENT], 10.0);
    if ($resp && $resp['status'] === 200) {
        $bullish = ['gain', 'bull', 'surge', 'up', 'rise', 'grow', 'profit', 'discovery'];
        $bearish = ['fall', 'slip', 'bear', 'down', 'drop', 'plunge', 'decline', 'loss'];
        $prevSetting = libxml_use_internal_errors(true);
        $root = simplexml_load_string($resp['body']);
        libxml_use_internal_errors($prevSetting);
        if ($root !== false) {
            $nodes = $root->xpath('//item');
            $count = 0;
            foreach ($nodes ?: [] as $item) {
                if ($count >= 8) {
                    break;
                }
                $count++;
                $title = (string)($item->title ?? '');
                $source = (string)($item->source ?? 'Google News');
                $pubDate = (string)($item->pubDate ?? '');

                $parsedTs = strtotime($pubDate);
                if ($parsedTs === false) {
                    continue;
                }
                if ((time() - $parsedTs) > 3 * 86400) {
                    continue;
                }

                $newsList[] = [
                    'title' => $title,
                    'link' => (string)($item->link ?? ''),
                    'pub_date' => $pubDate,
                    'source' => $source ?: 'Google News',
                    'sentiment' => classify_sentiment($title, $bullish, $bearish),
                ];
            }
        }
        if (!empty($newsList)) {
            cache_set('ticker_news', $cacheKey, $newsList, 200);
        }
    }

    if (empty($newsList)) {
        if ($profile && !empty($profile['recent_news'])) {
            return $profile['recent_news'];
        }
        return [[
            'title' => "No recent news articles found for $tickerUpper.",
            'link' => '#',
            'pub_date' => $nowGmt = gmdate('D, d M Y H:i:s') . ' GMT',
            'source' => 'System',
            'sentiment' => 'neutral',
        ]];
    }

    return $newsList;
}
