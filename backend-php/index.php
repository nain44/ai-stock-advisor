<?php
/**
 * Front controller / router for the MultiStocks AI PHP backend.
 *
 * Plain-PHP port of backend/main.py (FastAPI), built to run on ordinary
 * shared/cPanel-style hosting: no framework, no Composer dependency
 * required, no long-running process — just PHP-FPM/mod_php handling one
 * request at a time. See ../backend/main.py for the original route
 * definitions this mirrors, and README.md in this directory for
 * deployment instructions (.htaccess rewrite, env vars, etc).
 *
 * Scope: mobile-app-facing endpoints plus the /api/admin/* routes used by
 * the separate web admin dashboard (prompt controls, fetcher triggers,
 * logs, markets admin).
 */

declare(strict_types=1);

error_reporting(E_ALL & ~E_DEPRECATED);
ini_set('display_errors', '0'); // never leak PHP errors/warnings into JSON responses

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/stock_profiles.php';
require_once __DIR__ . '/lib/data_fetcher.php';
require_once __DIR__ . '/lib/technical_analysis.php';
require_once __DIR__ . '/lib/macro_fetcher.php';
require_once __DIR__ . '/lib/ai_advisor.php';
require_once __DIR__ . '/lib/markets.php';

// Load a simple KEY=VALUE .env file if present (no dependency needed).
// On hosts without shell/panel env var support, this is the fallback the
// README documents. Values already set via putenv()/panel env vars are
// left untouched (loaded .env values do not overwrite them).
(function () {
    $envPath = __DIR__ . '/.env';
    if (!is_file($envPath)) {
        return;
    }
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || strpos($line, '=') === false) {
            continue;
        }
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        if ($k !== '' && getenv($k) === false) {
            putenv("$k=$v");
        }
    }
})();

apply_cors();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

// Support being invoked either at the web root (with a rewrite rule) or
// directly as /index.php/api/... — strip a leading /index.php segment.
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
if ($scriptDir !== '' && str_starts_with($path, $scriptDir)) {
    $path = substr($path, strlen($scriptDir));
}
$path = preg_replace('#^/index\.php#', '', $path) ?: '/';
$path = '/' . ltrim($path, '/');
$path = rtrim($path, '/');
if ($path === '') {
    $path = '/';
}

/** Matches a route pattern like "/api/quote/{ticker}" against $path, returning captured params or null. */
function match_route(string $pattern, string $path): ?array
{
    $regex = preg_replace('#\{[a-zA-Z_]+\}#', '([^/]+)', $pattern);
    $regex = '#^' . $regex . '$#';
    if (!preg_match($regex, $path, $m)) {
        return null;
    }
    preg_match_all('#\{([a-zA-Z_]+)\}#', $pattern, $names);
    $params = [];
    foreach ($names[1] as $i => $name) {
        $params[$name] = urldecode($m[$i + 1]);
    }
    return $params;
}

function route(string $routeMethod, string $pattern, string $method, string $path): ?array
{
    if ($routeMethod !== $method) {
        return null;
    }
    return match_route($pattern, $path);
}

try {
    // GET /health
    if (($p = route('GET', '/health', $method, $path)) !== null) {
        json_response(['status' => 'ok', 'service' => 'backend']);
    }

    // GET /api/stocks
    if (($p = route('GET', '/api/stocks', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        $tickersParam = query_param('tickers');

        if ($tickersParam) {
            $tickerList = array_values(array_filter(array_map(fn($t) => strtoupper(trim($t)), explode(',', $tickersParam))));
        } else {
            $marketsConfig = markets_config();
            $marketData = $marketsConfig[$marketStr] ?? ($marketsConfig['PK'] ?? ['watchlist' => []]);
            $tickerList = $marketData['watchlist'] ?? [];
        }

        $result = [];
        foreach ($tickerList as $ticker) {
            $quote = get_latest_quote($ticker, $marketStr);
            $profile = $marketStr === 'PK' ? get_stock_profile($ticker) : null;

            $name = $profile['name'] ?? ($quote['name'] ?? $ticker);
            $sector = $profile['sector'] ?? ($quote['sector'] ?? 'Global Equity');

            if ($quote) {
                $pctVal = 0.0;
                $pctStr = $quote['pct_change'] ?? '0%';
                if ($pctStr && strpos($pctStr, '%') !== false) {
                    $pctVal = (float)str_replace('%', '', $pctStr);
                }

                $cacheKey = "$marketStr:$ticker";
                $cachedAnalysis = cache_get('analysis', $cacheKey, PHP_INT_MAX);
                if ($cachedAnalysis && !empty($cachedAnalysis['recommendation'])) {
                    $signal = $cachedAnalysis['recommendation']['recommendation'] ?? 'HOLD';
                } else {
                    if ($pctVal > 0.5) {
                        $signal = 'BUY';
                    } elseif ($pctVal < -0.5) {
                        $signal = 'SELL';
                    } else {
                        $signal = 'HOLD';
                    }
                }

                $result[] = [
                    'ticker' => $ticker,
                    'name' => $quote['name'] ?? $name,
                    'sector' => $quote['sector'] ?? $sector,
                    'current_price' => $quote['price'] ?? 0.0,
                    'change' => $quote['change'] ?? 0.0,
                    'change_percent' => $pctVal,
                    'high' => $quote['high'] ?? 0.0,
                    'low' => $quote['low'] ?? 0.0,
                    'volume' => $quote['volume'] ?? 0,
                    'ldcp' => $quote['ldcp'] ?? 0.0,
                    'signal' => $signal,
                    'is_live' => $quote['is_live'] ?? false,
                    'data_source' => $quote['source'] ?? 'simulated',
                ];
            } else {
                $result[] = [
                    'ticker' => $ticker, 'name' => $name, 'sector' => $sector,
                    'current_price' => 0.0, 'change' => 0.0, 'change_percent' => 0.0,
                    'high' => 0.0, 'low' => 0.0, 'volume' => 0, 'ldcp' => 0.0,
                    'signal' => 'HOLD', 'is_live' => false, 'data_source' => 'unavailable',
                ];
            }
        }
        json_response($result);
    }

    // GET /api/search
    if (($p = route('GET', '/api/search', $method, $path)) !== null) {
        $query = query_param('query', '');
        $marketStr = strtoupper(query_param('market', 'PK'));

        if (!$query || strlen($query) < 2) {
            json_response([]);
        }
        $query = strtoupper($query);

        $suffixes = market_ticker_suffixes();
        $indices = global_stock_indices();
        $marketsConfig = markets_config();

        $isGlobal = isset($suffixes[$marketStr]) || (isset($marketsConfig[$marketStr]) && $marketStr !== 'PK');

        if ($isGlobal) {
            $indexList = $indices[$marketStr] ?? [];
            if (empty($indexList) && isset($marketsConfig[$marketStr])) {
                $marketData = $marketsConfig[$marketStr];
                $watchlist = $marketData['watchlist'] ?? [];
                $indexList = [];
                foreach ($watchlist as $ticker) {
                    $indexList[] = [
                        'ticker' => $ticker,
                        'name' => "$ticker - Watchlist Stock",
                        'sector' => ($marketData['name'] ?? $marketStr) . ' Equity',
                    ];
                }
            }

            $matches = array_values(array_filter($indexList, function ($s) use ($query) {
                return strpos($s['ticker'], $query) !== false || strpos(strtoupper($s['name']), $query) !== false;
            }));

            $suffix = '';
            if (isset($suffixes[$marketStr])) {
                $suffix = $suffixes[$marketStr];
            } elseif (isset($marketsConfig[$marketStr])) {
                $marketData = $marketsConfig[$marketStr];
                $defaultTicker = $marketData['defaultTicker'] ?? '';
                if (strpos($defaultTicker, '.') !== false) {
                    $suffix = '.' . explode('.', $defaultTicker, 2)[1];
                } elseif (strpos($defaultTicker, '=') !== false) {
                    $suffix = '=' . explode('=', $defaultTicker, 2)[1];
                } else {
                    foreach (($marketData['watchlist'] ?? []) as $ticker) {
                        if (strpos($ticker, '.') !== false) {
                            $suffix = '.' . explode('.', $ticker, 2)[1];
                            break;
                        }
                        if (strpos($ticker, '=') !== false) {
                            $suffix = '=' . explode('=', $ticker, 2)[1];
                            break;
                        }
                    }
                }
            }

            $sector = "$marketStr Equity";
            if (isset($marketsConfig[$marketStr])) {
                $sector = ($marketsConfig[$marketStr]['name'] ?? $marketStr) . ' Equity';
            }

            $hasExactMatch = false;
            foreach ($matches as $m) {
                if (explode('.', $m['ticker'])[0] === $query) {
                    $hasExactMatch = true;
                    break;
                }
            }
            if (strlen($query) >= 3 && strlen($query) <= 6 && !$hasExactMatch) {
                $customTicker = str_ends_with($query, $suffix) ? $query : "$query$suffix";
                array_unshift($matches, ['ticker' => $customTicker, 'name' => "$query - Custom $marketStr Ticker", 'sector' => $sector]);
            }
            json_response(array_slice($matches, 0, 10));
        }

        try {
            $symbolIndex = get_pk_symbol_index();
            $matches = array_values(array_filter($symbolIndex, function ($s) use ($query) {
                return strpos(strtoupper($s['ticker']), $query) !== false || strpos(strtoupper($s['name']), $query) !== false;
            }));
            json_response(array_slice($matches, 0, 10));
        } catch (Throwable $e) {
            json_response([]);
        }
    }

    // GET /api/quote/{ticker}
    if (($p = route('GET', '/api/quote/{ticker}', $method, $path)) !== null) {
        $marketStr = query_param('market', 'PK') ?: 'PK';
        $quote = get_latest_quote($p['ticker'], $marketStr);
        if (!$quote) {
            json_error('Stock ticker not found.', 404);
        }
        json_response($quote);
    }

    // GET /api/historical/{ticker}
    if (($p = route('GET', '/api/historical/{ticker}', $method, $path)) !== null) {
        $days = (int)(query_param('days', '120'));
        $marketStr = query_param('market', 'PK') ?: 'PK';
        $data = generate_historical_data($p['ticker'], $days, $marketStr);
        json_response($data);
    }

    // GET /api/analysis/{ticker}
    if (($p = route('GET', '/api/analysis/{ticker}', $method, $path)) !== null) {
        $ticker = $p['ticker'];
        $marketStr = query_param('market', 'PK') ?: 'PK';
        $marketUpper = strtoupper($marketStr);

        $quote = get_latest_quote($ticker, $marketStr);
        $profile = $marketUpper === 'PK' ? get_stock_profile($ticker) : null;

        if (!$quote) {
            if (!$profile) {
                json_error('Stock ticker not found.', 404);
            }
            $quote = [
                'ticker' => $ticker,
                'name' => $profile['name'] ?? $ticker,
                'price' => $profile['current_price'] ?? 0.0,
                'change' => 0.0,
                'pct_change' => '0.0%',
                'is_up' => true,
                'high' => $profile['current_price'] ?? 0.0,
                'low' => $profile['current_price'] ?? 0.0,
                'ldcp' => $profile['current_price'] ?? 0.0,
                'volume' => $profile['volume_avg'] ?? 0,
                'pe' => $profile['pe_ratio'] ?? 0.0,
                'roe' => $profile['roe'] ?? 0.0,
                'div_yield' => $profile['div_yield'] ?? 0.0,
                'news' => $profile['recent_news'] ?? [],
            ];
            $liveProfile = $profile;
            $liveProfile['is_live'] = false;
            $liveProfile['data_source'] = 'simulated';
        } else {
            if ($marketUpper !== 'PK') {
                $liveProfile = [
                    'name' => $quote['name'],
                    'sector' => $quote['sector'],
                    'current_price' => $quote['price'],
                    'change' => $quote['change'],
                    'change_percent' => strpos($quote['pct_change'], '%') !== false ? (float)str_replace('%', '', $quote['pct_change']) : 0.0,
                    'high' => $quote['high'],
                    'low' => $quote['low'],
                    'volume_avg' => $quote['volume'],
                    'pe_ratio' => $quote['pe'],
                    'pb_ratio' => $quote['pb_ratio'] ?? 1.0,
                    'debt_equity' => $quote['debt_equity'] ?? 0.0,
                    'roe' => $quote['roe'] ?? 0.0,
                    'div_yield' => $quote['div_yield'] ?? 0.0,
                    'eps' => $quote['eps'] ?? 0.0,
                    'description' => $quote['description'] ?? "$marketUpper Equity",
                    'recent_news' => $quote['news'] ?? [],
                    'is_live' => $quote['is_live'] ?? false,
                    'data_source' => $quote['source'] ?? 'simulated',
                    'price_date' => $quote['price_date'] ?? null,
                ];
            } else {
                $sector = $profile['sector'] ?? 'PSX Equity';
                $liveProfile = [
                    'name' => $quote['name'],
                    'sector' => $sector,
                    'current_price' => $quote['price'],
                    'change' => $quote['change'],
                    'change_percent' => strpos($quote['pct_change'], '%') !== false ? (float)str_replace('%', '', $quote['pct_change']) : 0.0,
                    'high' => $quote['high'],
                    'low' => $quote['low'],
                    'volume_avg' => $quote['volume'],
                    'pe_ratio' => $quote['pe'],
                    'pb_ratio' => $profile['pb_ratio'] ?? 1.0,
                    'debt_equity' => $profile['debt_equity'] ?? 0.0,
                    'roe' => $quote['roe'] ?: ($profile['roe'] ?? 0.0),
                    'div_yield' => $quote['div_yield'],
                    'eps' => $profile['eps'] ?? 0.0,
                    'description' => $profile['description'] ?? 'A listed equity on the Pakistan Stock Exchange.',
                    'recent_news' => $quote['news'],
                    'is_live' => $quote['is_live'] ?? false,
                    'data_source' => $quote['source'] ?? 'simulated',
                    'price_date' => $quote['price_date'] ?? null,
                ];
            }
        }

        $liveProfile['recent_news'] = fetch_ticker_news($ticker, $marketStr);

        $historical = generate_historical_data($ticker, 120, $marketStr);
        $techAnalysis = run_full_technical_analysis($historical);

        $recommendation = get_llm_recommendation($ticker, (float)$quote['price'], $techAnalysis, $liveProfile, $marketStr);

        $result = [
            'ticker' => $ticker,
            'profile' => $liveProfile,
            'technical_analysis' => $techAnalysis,
            'recommendation' => $recommendation,
        ];

        cache_set('analysis', "$marketUpper:$ticker", $result, 200);
        json_response($result);
    }

    // POST /api/portfolio/analysis
    if (($p = route('POST', '/api/portfolio/analysis', $method, $path)) !== null) {
        $body = read_json_body();
        $portfolio = $body['portfolio'] ?? null;
        if (!$portfolio || !is_array($portfolio) || count($portfolio) === 0) {
            json_error('Portfolio cannot be empty.', 400);
        }
        $marketStr = $body['market'] ?? 'PK';
        $marketUpper = strtoupper($marketStr);

        $totalCost = 0.0;
        $totalValue = 0.0;
        $holdingsMetrics = [];

        foreach ($portfolio as $holding) {
            $ticker = strtoupper($holding['ticker'] ?? '');
            $qty = (float)($holding['quantity'] ?? 0);
            $avgPrice = (float)($holding['avgPrice'] ?? 0);
            $hasCurrentPrice = isset($holding['currentPrice']) && $holding['currentPrice'] !== null;
            $currentPrice = $hasCurrentPrice ? (float)$holding['currentPrice'] : $avgPrice;

            $profile = $marketUpper === 'PK' ? get_stock_profile($ticker) : null;
            $name = $profile['name'] ?? $ticker;
            $sector = $profile['sector'] ?? ($marketUpper === 'PK' ? 'PSX Equity' : "$marketUpper Equity");

            $costVal = $avgPrice * $qty;
            $currentVal = $currentPrice * $qty;
            $pnlVal = $currentVal - $costVal;
            $pnlPct = $costVal > 0 ? ($pnlVal / $costVal) * 100 : 0.0;

            $totalCost += $costVal;
            $totalValue += $currentVal;

            $holdingsMetrics[] = [
                'ticker' => $ticker, 'name' => $name, 'sector' => $sector,
                'quantity' => $qty, 'avg_buy_price' => $avgPrice, 'current_price' => $currentPrice,
                'price_is_user_reported' => $hasCurrentPrice,
                'total_cost' => $costVal, 'current_value' => $currentVal,
                'pnl' => $pnlVal, 'pnl_percent' => $pnlPct,
            ];
        }

        $sectorWeights = [];
        foreach ($holdingsMetrics as &$h) {
            $w = $totalValue > 0 ? ($h['current_value'] / $totalValue) * 100 : 0.0;
            $h['weight_percent'] = round($w, 2);
            $sectorWeights[$h['sector']] = ($sectorWeights[$h['sector']] ?? 0.0) + $w;
        }
        unset($h);
        foreach ($sectorWeights as $sec => $w) {
            $sectorWeights[$sec] = round($w, 2);
        }

        $portfolioSummary = [
            'total_cost' => round($totalCost, 2),
            'total_value' => round($totalValue, 2),
            'total_pnl' => round($totalValue - $totalCost, 2),
            'total_pnl_percent' => $totalCost > 0 ? round((($totalValue - $totalCost) / $totalCost) * 100, 2) : 0.0,
            'holdings' => $holdingsMetrics,
            'sector_allocation' => $sectorWeights,
        ];

        $aiDiagnosis = get_portfolio_recommendation($portfolioSummary, $marketStr);

        json_response(['summary' => $portfolioSummary, 'analysis' => $aiDiagnosis]);
    }

    // POST /api/chat
    if (($p = route('POST', '/api/chat', $method, $path)) !== null) {
        $body = read_json_body();
        $query = $body['query'] ?? '';
        if (!$query) {
            json_error('Query cannot be empty.', 400);
        }
        $ticker = $body['ticker'] ?? null;
        $portfolio = $body['portfolio'] ?? null;
        $market = $body['market'] ?? 'PK';

        $responseText = query_chat_advisor($query, $ticker, $portfolio, $market ?: 'PK');
        json_response(['response' => $responseText]);
    }

    // GET /api/config
    if (($p = route('GET', '/api/config', $method, $path)) !== null) {
        $marketsData = [];
        $welcomeMessages = [];
        $suggestionChips = [];

        foreach (markets_config() as $key => $val) {
            $marketsData[$key] = [
                'name' => $val['name'], 'flag' => $val['flag'], 'title' => $val['title'],
                'subtitle' => $val['subtitle'], 'currency' => $val['currency'],
                'defaultTicker' => $val['defaultTicker'], 'watchlist' => $val['watchlist'],
            ];
            $welcomeMessages[$key] = $val['welcome'];
            $suggestionChips[$key] = $val['suggestions'];
        }

        json_response([
            'markets' => $marketsData,
            'chat' => ['welcome_messages' => $welcomeMessages, 'suggestion_chips' => $suggestionChips],
        ]);
    }

    // GET /api/news
    if (($p = route('GET', '/api/news', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        json_response(fetch_market_news($marketStr));
    }

    // GET /api/macro
    if (($p = route('GET', '/api/macro', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        $marketsConfig = markets_config();
        $marketData = $marketsConfig[$marketStr] ?? ($marketsConfig['PK'] ?? []);
        $indexSymbol = $marketData['index_symbol'] ?? '^KSE';

        $subtitle = $marketData['subtitle'] ?? 'Stock Index';
        $indexName = strpos($subtitle, ' (') !== false ? explode(' (', $subtitle)[0] : $subtitle;
        $indexNamesMap = macro_index_names_map();
        $indexName = $indexNamesMap[$indexSymbol] ?? $indexName;

        json_response(get_macro_indicators($marketStr, $indexSymbol, $indexName));
    }

    // GET /api/forex/rates
    if (($p = route('GET', '/api/forex/rates', $method, $path)) !== null) {
        json_response(['base' => 'USD', 'rates' => get_all_forex_rates()]);
    }

    // GET /api/zakat/nisab
    if (($p = route('GET', '/api/zakat/nisab', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        json_response(get_zakat_nisab($marketStr));
    }

    // GET /api/market-digest
    if (($p = route('GET', '/api/market-digest', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        $newsItems = fetch_market_news($marketStr);

        $marketsConfig = markets_config();
        $marketData = $marketsConfig[$marketStr] ?? ($marketsConfig['PK'] ?? []);
        $indexSymbol = $marketData['index_symbol'] ?? '^KSE';
        $subtitle = $marketData['subtitle'] ?? 'Stock Index';
        $indexName = strpos($subtitle, ' (') !== false ? explode(' (', $subtitle)[0] : $subtitle;
        $indexNamesMap = macro_index_names_map();
        $indexName = $indexNamesMap[$indexSymbol] ?? $indexName;

        $macroData = get_macro_indicators($marketStr, $indexSymbol, $indexName);
        $digest = get_market_digest($newsItems, $macroData, $marketStr, $marketData['name'] ?? null);

        json_response([
            'digest' => $digest,
            'news' => array_slice($newsItems, 0, 8),
            'generated_at' => date('h:i A'),
        ]);
    }

    // GET /api/settings
    if (($p = route('GET', '/api/settings', $method, $path)) !== null) {
        json_response([
            'has_gemini' => ai_has_gemini(),
            'has_openai' => ai_has_openai(),
            'gemini_key_mask' => ai_has_gemini() ? '********' : '',
            'openai_key_mask' => ai_has_openai() ? '********' : '',
            'use_test_ads' => strtolower(env_get('USE_TEST_ADS') ?? 'true') === 'true',
            'mobile_api_url' => env_get('MOBILE_API_URL') ?? '',
        ]);
    }

    // POST /api/settings
    // Divergence from Python: the Python backend persists updated keys by
    // rewriting a local .env file on disk and hot-swapping the in-process
    // SDK clients. On typical shared hosting, PHP-FPM workers are
    // stateless between requests and the webroot is frequently
    // non-writable, so this port persists into backend-php/.env the same
    // way, but there is no in-process client to hot-swap — the new values
    // simply take effect on the next request (once loaded from .env or
    // set via the host's control panel / putenv()).
    if (($p = route('POST', '/api/settings', $method, $path)) !== null) {
        $body = read_json_body();
        $envPath = __DIR__ . '/.env';
        $envDict = [];

        if (is_file($envPath)) {
            foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                $line = trim($line);
                if (strpos($line, '=') !== false && !str_starts_with($line, '#')) {
                    [$k, $v] = explode('=', $line, 2);
                    $envDict[trim($k)] = trim($v);
                }
            }
        }

        if (array_key_exists('gemini_key', $body) && $body['gemini_key'] !== null) {
            $envDict['GEMINI_API_KEY'] = $body['gemini_key'];
        }
        if (array_key_exists('openai_key', $body) && $body['openai_key'] !== null) {
            $envDict['OPENAI_API_KEY'] = $body['openai_key'];
        }
        if (array_key_exists('use_test_ads', $body) && $body['use_test_ads'] !== null) {
            $envDict['USE_TEST_ADS'] = $body['use_test_ads'] ? 'true' : 'false';
        }
        if (array_key_exists('mobile_api_url', $body) && $body['mobile_api_url'] !== null) {
            $mobileApiUrl = rtrim(trim($body['mobile_api_url']), '/');
            $parsed = parse_url($mobileApiUrl);
            if (!$parsed || ($parsed['scheme'] ?? '') !== 'https' || empty($parsed['host'])) {
                json_error('Mobile API URL must be a valid HTTPS URL.', 400);
            }
            $envDict['MOBILE_API_URL'] = $mobileApiUrl;
        }

        $lines = [];
        foreach ($envDict as $k => $v) {
            $lines[] = "$k=$v";
        }
        $written = @file_put_contents($envPath, implode("\n", $lines) . "\n");
        if ($written === false) {
            json_error('Unable to write settings — the web root may not be writable on this host. Set environment variables via your hosting control panel instead.', 500);
        }

        json_response(['status' => 'success', 'message' => 'Settings updated successfully']);
    }

    // GET /api/admin/prompt
    if (($p = route('GET', '/api/admin/prompt', $method, $path)) !== null) {
        $defaultPortfolio = "You are a premier quantitative financial analyst and portfolio manager advising a retail investor on their {exchange_name} portfolio.\nAnalyze the following portfolio summary details and return a structured JSON response evaluating its risk, performance, diversification, and actionable rebalancing.";
        $defaultChat = "You are a professional financial advisor for {market_name}.\n{context}\nUser asks: '{query}'\n\nProvide a clear, detailed, professional answer in markdown. Mention tickers, numbers, and structural arguments (inflation, interest rates, earnings) where relevant.";

        json_response([
            'portfolio_prompt' => load_custom_prompt('portfolio_prompt', $defaultPortfolio),
            'chat_prompt' => load_custom_prompt('chat_prompt', $defaultChat),
        ]);
    }

    // POST /api/admin/prompt
    if (($p = route('POST', '/api/admin/prompt', $method, $path)) !== null) {
        $body = read_json_body();
        $promptsPath = __DIR__ . '/prompts.json';
        $data = [];
        if (is_file($promptsPath)) {
            $raw = @file_get_contents($promptsPath);
            $decoded = $raw !== false ? json_decode($raw, true) : null;
            if (is_array($decoded)) {
                $data = $decoded;
            }
        }

        if (array_key_exists('portfolio_prompt', $body) && $body['portfolio_prompt'] !== null) {
            $data['portfolio_prompt'] = $body['portfolio_prompt'];
        }
        if (array_key_exists('chat_prompt', $body) && $body['chat_prompt'] !== null) {
            $data['chat_prompt'] = $body['chat_prompt'];
        }

        $written = @file_put_contents($promptsPath, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        if ($written === false) {
            json_error('Unable to write prompts.json — the web root may not be writable on this host.', 500);
        }
        system_event_add('System prompt templates updated by admin.');
        json_response(['status' => 'success', 'message' => 'Prompts updated successfully']);
    }

    // POST /api/admin/fetcher/trigger?market=PK
    if (($p = route('POST', '/api/admin/fetcher/trigger', $method, $path)) !== null) {
        $marketStr = strtoupper(query_param('market', 'PK'));
        system_event_add("Manual fetcher triggered for market: $marketStr");

        try {
            $marketsConfig = markets_config();
            $watchlist = ($marketsConfig[$marketStr] ?? ($marketsConfig['PK'] ?? ['watchlist' => []]))['watchlist'] ?? [];
            foreach ($watchlist as $ticker) {
                get_latest_quote($ticker, $marketStr);
            }
            system_event_add("Fetcher completed: refreshed watchlist tickers for $marketStr");
            json_response(['status' => 'success', 'message' => "Data refresh completed for market $marketStr"]);
        } catch (Throwable $e) {
            system_event_add('Fetcher failed: ' . $e->getMessage());
            json_error($e->getMessage(), 500);
        }
    }

    // GET /api/admin/logs
    if (($p = route('GET', '/api/admin/logs', $method, $path)) !== null) {
        json_response(system_events_get());
    }

    // GET /api/admin/markets
    if (($p = route('GET', '/api/admin/markets', $method, $path)) !== null) {
        json_response(markets_config());
    }

    // POST /api/admin/markets
    if (($p = route('POST', '/api/admin/markets', $method, $path)) !== null) {
        $newConfig = read_json_body();
        $marketsPath = __DIR__ . '/data/markets.json';
        $written = @file_put_contents($marketsPath, json_encode($newConfig, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
        if ($written === false) {
            json_error('Unable to write data/markets.json — the web root may not be writable on this host.', 500);
        }
        system_event_add('Markets and watchlists configurations updated by admin.');
        json_response(['status' => 'success', 'message' => 'Markets configuration updated successfully']);
    }

    json_error('Not found.', 404);
} catch (Throwable $e) {
    json_error('Internal server error: ' . $e->getMessage(), 500);
}
