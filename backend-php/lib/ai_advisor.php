<?php
/**
 * Ported from backend/ai_advisor.py.
 *
 * Rule-based recommendation/chat/portfolio logic is ported 1:1. The two
 * real external calls (Gemini, OpenAI) are made here via PHP curl against
 * their plain REST endpoints instead of the Python SDKs:
 *   - Gemini: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=API_KEY
 *   - OpenAI: POST https://api.openai.com/v1/chat/completions (Bearer auth)
 * API keys are read from environment variables (GEMINI_API_KEY,
 * OPENAI_API_KEY) via getenv() — never hardcoded.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/data_fetcher.php';

const GEMINI_MODEL = 'gemini-1.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini';

function env_get(string $key): ?string
{
    $val = getenv($key);
    if ($val === false || $val === '') {
        return null;
    }
    return $val;
}

function ai_has_gemini(): bool
{
    return env_get('GEMINI_API_KEY') !== null;
}

function ai_has_openai(): bool
{
    return env_get('OPENAI_API_KEY') !== null;
}

/** Loads a custom prompt override from prompts.json (same file as the Python backend). */
function load_custom_prompt(string $key, string $default): string
{
    $path = __DIR__ . '/../prompts.json';
    if (is_file($path)) {
        $raw = @file_get_contents($path);
        if ($raw !== false) {
            $data = json_decode($raw, true);
            if (is_array($data) && isset($data[$key]) && is_string($data[$key])) {
                return $data[$key];
            }
        }
    }
    return $default;
}

/**
 * Strips a leading ```json / ``` and trailing ``` fence from an LLM text
 * response, matching the Python backend's simple markdown-fence cleanup.
 */
function strip_json_fence(string $text): string
{
    $text = trim($text);
    if (str_starts_with($text, '```json')) {
        $text = substr($text, 7);
    } elseif (str_starts_with($text, '```')) {
        $firstNewline = strpos($text, "\n");
        if ($firstNewline !== false) {
            $text = substr($text, $firstNewline + 1);
        }
    }
    if (str_ends_with(trim($text), '```')) {
        $text = rtrim($text);
        $text = substr($text, 0, -3);
    }
    return trim($text);
}

/** Calls Gemini's generateContent REST endpoint with a plain text prompt. Returns the text or null on failure. */
function gemini_generate_text(string $prompt): ?string
{
    $apiKey = env_get('GEMINI_API_KEY');
    if (!$apiKey) {
        return null;
    }
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . GEMINI_MODEL . ':generateContent?key=' . rawurlencode($apiKey);
    $payload = [
        'contents' => [
            ['parts' => [['text' => $prompt]]],
        ],
    ];
    try {
        $resp = http_post_json($url, $payload, [], 25.0);
        if (!$resp || $resp['status'] !== 200) {
            return null;
        }
        $data = json_decode($resp['body'], true);
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
        return is_string($text) ? trim($text) : null;
    } catch (Throwable $e) {
        return null;
    }
}

/** Calls OpenAI's chat completions REST endpoint. Returns the text or null on failure. */
function openai_generate_text(string $prompt, ?string $systemMessage = null): ?string
{
    $apiKey = env_get('OPENAI_API_KEY');
    if (!$apiKey) {
        return null;
    }
    $messages = [];
    if ($systemMessage) {
        $messages[] = ['role' => 'system', 'content' => $systemMessage];
    }
    $messages[] = ['role' => 'user', 'content' => $prompt];

    $payload = [
        'model' => OPENAI_MODEL,
        'messages' => $messages,
        'temperature' => 0.2,
    ];
    try {
        $resp = http_post_json('https://api.openai.com/v1/chat/completions', $payload, [
            'Authorization: Bearer ' . $apiKey,
        ], 25.0);
        if (!$resp || $resp['status'] !== 200) {
            return null;
        }
        $data = json_decode($resp['body'], true);
        $text = $data['choices'][0]['message']['content'] ?? null;
        return is_string($text) ? trim($text) : null;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * Formulates a detailed, analytical, rule-based recommendation for
 * Simulator Mode. Ported 1:1 from get_rule_based_recommendation().
 */
function get_rule_based_recommendation(string $ticker, float $price, array $techAnalysis, array $profile): array
{
    $rsiVal = $techAnalysis['rsi']['value'];
    $macdCross = $techAnalysis['macd']['crossover'];
    $pe = $profile['pe_ratio'];
    $roe = $profile['roe'];

    $score = 50;
    $reasons = [];

    if ($rsiVal < 30) {
        $score += 20;
        $reasons[] = "RSI is oversold ($rsiVal), suggesting a strong rebound candidate";
    } elseif ($rsiVal < 45) {
        $score += 10;
        $reasons[] = "RSI is recovering ($rsiVal) and building bullish momentum";
    } elseif ($rsiVal > 70) {
        $score -= 20;
        $reasons[] = "RSI is overbought ($rsiVal), representing high short-term correction risk";
    } elseif ($rsiVal > 55) {
        $score -= 5;
        $reasons[] = "RSI is moderately high ($rsiVal), trading close to local resistance levels";
    } else {
        $reasons[] = "RSI is stable at $rsiVal, suggesting balanced consolidation";
    }

    if ($macdCross === 'Bullish Crossover') {
        $score += 15;
        $reasons[] = 'MACD indicator triggered a bullish crossover (Line crossed above Signal line)';
    } elseif ($macdCross === 'Bearish Crossover') {
        $score -= 15;
        $reasons[] = 'MACD indicator triggered a bearish crossover (Line crossed below Signal line)';
    } else {
        $hist = $techAnalysis['macd']['histogram'];
        if ($hist > 0) {
            $score += 5;
            $reasons[] = 'MACD histogram is positive, indicating upward momentum';
        } else {
            $score -= 5;
            $reasons[] = 'MACD histogram is negative, indicating weak price action';
        }
    }

    $volRatio = $techAnalysis['volume']['ratio'];
    if ($volRatio > 1.3) {
        if ($rsiVal < 50) {
            $score += 8;
            $pctAbove = (int)(($volRatio - 1) * 100);
            $reasons[] = "Trading volume is {$pctAbove}% above average, showing high accumulation interest";
        } else {
            $score -= 5;
            $reasons[] = "High trading volume ({$volRatio}x avg) at elevated prices suggests profit-taking";
        }
    }

    if ($pe < 7.0 && $roe > 20.0) {
        $score += 12;
        $reasons[] = "Compelling valuations: Under-valued PE ratio of $pe coupled with strong ROE of {$roe}%";
    } elseif ($pe > 18.0) {
        $score -= 10;
        $reasons[] = "High P/E multiple of {$pe}x requires strong earnings growth to sustain current price";
    }

    $recentNews = $profile['recent_news'] ?? [];
    $bullishNews = array_filter($recentNews, fn($n) => ($n['sentiment'] ?? null) === 'bullish');
    $bearishNews = array_filter($recentNews, fn($n) => ($n['sentiment'] ?? null) === 'bearish');

    if (count($bullishNews) > count($bearishNews)) {
        $score += 8;
        $reasons[] = 'Positive corporate announcements and macro news sentiment';
    } elseif (count($bearishNews) > count($bullishNews)) {
        $score -= 8;
        $reasons[] = 'Recent regulatory or industry developments pressing margins';
    }

    if ($score >= 65) {
        $rec = 'BUY';
        $riskLevel = $score < 75 ? 'Medium' : 'Low';
    } elseif ($score <= 38) {
        $rec = 'SELL';
        $riskLevel = $score < 28 ? 'High' : 'Medium';
    } else {
        $rec = 'HOLD';
        $riskLevel = 'Low';
    }

    $confidence = min(max((int)($score + mt_rand(-5, 5)), 40), 96);

    if ($rec === 'BUY') {
        $entry = round($price * 0.99, 1);
        $target1 = round($price * 1.07, 1);
        $target2 = round($price * 1.12, 1);
        $stopLoss = round($price * 0.95, 1);
    } elseif ($rec === 'SELL') {
        $entry = round($price, 1);
        $target1 = round($price * 0.93, 1);
        $target2 = round($price * 0.88, 1);
        $stopLoss = round($price * 1.05, 1);
    } else {
        $entry = round($price, 1);
        $target1 = round($price * 1.04, 1);
        $target2 = round($price * 1.08, 1);
        $stopLoss = round($price * 0.94, 1);
    }

    return [
        'ticker' => $ticker,
        'name' => $profile['name'],
        'recommendation' => $rec,
        'entry' => $entry,
        'target1' => $target1,
        'target2' => $target2,
        'stop_loss' => $stopLoss,
        'confidence' => "{$confidence}%",
        'risk_level' => $riskLevel,
        'reasons' => array_values($reasons),
        'is_simulated' => true,
    ];
}

function market_currency_and_exchange(string $marketUpper): array
{
    if ($marketUpper === 'US') {
        return ['$', 'United States Stock Market (NYSE/NASDAQ)'];
    }
    if ($marketUpper === 'IN') {
        return ['₹', 'National Stock Exchange of India (NSE)'];
    }
    if ($marketUpper === 'UK') {
        return ['£', 'London Stock Exchange (LSE)'];
    }
    return ['Rs.', 'Pakistan Stock Exchange (PSX)'];
}

/**
 * Queries Gemini or OpenAI using structured prompts for a single stock's
 * recommendation. Falls back to the rule-based engine if no API keys are
 * configured or if the API calls fail / return unparsable JSON.
 */
function get_llm_recommendation(string $ticker, float $price, array $techAnalysis, array $profile, string $market = 'PK'): array
{
    $ticker = strtoupper($ticker);
    $marketUpper = strtoupper($market);
    [$currencySymbol, $exchangeName] = market_currency_and_exchange($marketUpper);

    $promptData = [
        'Ticker' => $ticker,
        'Company Name' => $profile['name'],
        'Sector' => $profile['sector'],
        'Current Price' => "$currencySymbol $price",
        'Fundamentals' => [
            'P/E Ratio' => $profile['pe_ratio'],
            'ROE (%)' => $profile['roe'],
            'Dividend Yield (%)' => $profile['div_yield'],
            'Debt/Equity (%)' => $profile['debt_equity'],
            'EPS' => $profile['eps'],
        ],
        'Technical Indicators' => [
            'RSI (14)' => $techAnalysis['rsi']['value'],
            'RSI Status' => $techAnalysis['rsi']['status'],
            'MACD Crossover' => $techAnalysis['macd']['crossover'],
            'MACD Line' => $techAnalysis['macd']['line'],
            'MACD Signal' => $techAnalysis['macd']['signal'],
            'Price Relative to SMA 50' => $techAnalysis['moving_averages']['sma_50_status'],
            'Price Relative to SMA 200' => $techAnalysis['moving_averages']['sma_200_status'],
            'Bollinger Bands status' => $techAnalysis['bollinger_bands']['status'],
            'Volume Status' => $techAnalysis['volume']['status'],
            'Volume Ratio' => $techAnalysis['volume']['ratio'],
        ],
        'Recent News' => $profile['recent_news'] ?? [],
        'Business Description' => $profile['description'] ?? '',
    ];

    $promptDataJson = json_encode($promptData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $nameJson = json_encode($profile['name']);

    $prompt = <<<PROMPT
    You are an expert financial analyst advising retail investors on the {$exchangeName}.
    Analyze the following stock data carefully and provide a structured JSON response:

    {$promptDataJson}

    Provide your advice in the following exact JSON format:
    {
        "ticker": "{$ticker}",
        "name": {$nameJson},
        "recommendation": "BUY" or "SELL" or "HOLD",
        "entry": <reasonable entry price as float in {$currencySymbol}>,
        "target1": <target price 1 as float in {$currencySymbol}>,
        "target2": <target price 2 as float in {$currencySymbol}>,
        "stop_loss": <suggested stop loss as float in {$currencySymbol}>,
        "confidence": "<confidence score between 10% and 99%, e.g., '84%'>",
        "risk_level": "Low" or "Medium" or "High",
        "reasons": [
            "Reason 1 based on technials/fundamentals",
            "Reason 2...",
            "Reason 3..."
        ],
        "is_simulated": false
    }

    Ensure targets and stop losses are numerically logical based on the current price. Return ONLY the raw JSON block without markdown code fences.
    PROMPT;

    if (ai_has_gemini()) {
        $text = gemini_generate_text($prompt);
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                $decoded['is_simulated'] = false;
                return $decoded;
            }
        }
    }

    if (ai_has_openai()) {
        $text = openai_generate_text($prompt);
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                $decoded['is_simulated'] = false;
                return $decoded;
            }
        }
    }

    return get_rule_based_recommendation($ticker, $price, $techAnalysis, $profile);
}

const CHAT_STOP_WORDS = [
    'WHY', 'HOW', 'WHAT', 'WHO', 'WHEN', 'WHERE', 'BUY', 'SELL', 'HOLD',
    'IS', 'AM', 'ARE', 'THE', 'THIS', 'THAT', 'SHOULD', 'COULD', 'WOULD',
    'CAN', 'YOU', 'ME', 'MY', 'YOUR', 'WE', 'OUR', 'THEY', 'FOR', 'AND',
    'BUT', 'OR', 'IF', 'IN', 'ON', 'AT', 'TO', 'OF', 'WITH', 'BY', 'AN',
    'AS', 'DO', 'DOES', 'DID', 'GET', 'GIVE', 'MAKE', 'TAKE', 'ANALYZE',
    'OPINION', 'STOCK', 'STOCKS', 'MARKET', 'MARKETS', 'CHART', 'CHARTS',
    'I', 'WHICH', 'SHARE', 'SHARES', 'ANY', 'SOME', 'MANY', 'ALL', 'GOOD',
    'BEST', 'TOP', 'PORTFOLIO', 'INVEST', 'INVESTMENT', 'INVESTMENTS', 'TRADE',
    'TRADING', 'EXCHANGE', 'EXCHANGES', 'PRICE', 'PRICES', 'GRAPH', 'GRAPHS',
    'VALUE', 'VALUATION', 'ANALYSIS', 'RECOMMEND', 'RECOMMENDATION', 'RECOMMENDATIONS',
    'ADVISE', 'ADVICE', 'ADVISOR', 'PERFORMANCE', 'TREND', 'TRENDS', 'PATTERN',
    'PATTERNS', 'INDICATOR', 'INDICATORS', 'RSI', 'MACD', 'BOLLINGER', 'EMA',
    'SMA', 'MOVING', 'AVERAGE', 'DIVIDEND', 'DIVIDENDS', 'YIELD', 'GROWTH',
    'TECH', 'DEFENSIVE', 'INTEREST', 'RATE', 'RATES', 'INFLATION', 'SBP',
    'FED', 'POLICY', 'CEMENT', 'STEEL', 'BANK', 'BANKS', 'ENERGY', 'FERTILIZER',
    'NEWS', 'ANNOUNCEMENT', 'ANNOUNCEMENTS', 'FALL', 'FELL', 'DOWN', 'UP',
    'RISE', 'ROSE', 'GAIN', 'GAINS', 'LOSS', 'LOSSES', 'TODAY', 'YESTERDAY',
    'WEEK', 'MONTH', 'YEAR', 'DAY', 'DAYS', 'ONE', 'TWO', 'THREE', 'TEN',
    'HI', 'HELLO', 'HEY', 'PLEASE',
];

/**
 * Rule-based interactive agent responses for Simulator Mode. Ported 1:1
 * from generate_simulator_chat_response().
 */
function generate_simulator_chat_response(string $query, ?array $portfolio = null, string $market = 'PK'): string
{
    $queryLower = strtolower($query);
    $marketUpper = strtoupper($market ?: 'PK');
    $stopWords = array_flip(CHAT_STOP_WORDS);

    $marketName = 'Pakistan Stock Exchange (PSX)';
    $currency = 'PKR';
    $marketLabel = 'PSX';
    $sellMari = '- *Should I sell MARI?*';
    $whySys = '- *Why did SYS fall today?*';
    $cementCo = '- *Find undervalued cement companies.*';
    $defStocks = '- *Which stocks benefit from lower interest rates?*';
    $dividendP = '- *Build me a dividend portfolio.*';
    $defaultStockEx = 'MARI, SYS, or UBL';

    if ($marketUpper === 'US') {
        $marketName = 'US Stock Markets (NYSE/NASDAQ)';
        $currency = 'USD';
        $marketLabel = 'US markets';
        $sellMari = '- *Should I sell AAPL?*';
        $whySys = '- *Why did TSLA fall today?*';
        $cementCo = '- *Find undervalued tech companies.*';
        $defStocks = '- *Which stocks benefit from lower inflation?*';
        $dividendP = '- *Build me a high-growth tech portfolio.*';
        $defaultStockEx = 'AAPL, MSFT, or TSLA';
    } elseif ($marketUpper === 'IN') {
        $marketName = 'National Stock Exchange of India (NSE)';
        $currency = 'INR';
        $marketLabel = 'NSE India';
        $sellMari = '- *Should I sell RELIANCE.NS?*';
        $whySys = '- *Why did TCS.NS fall today?*';
        $cementCo = '- *Find undervalued bank companies.*';
        $defStocks = '- *Which stocks benefit from monetary expansion?*';
        $dividendP = '- *Build me an Indian dividend portfolio.*';
        $defaultStockEx = 'RELIANCE.NS, TCS.NS, or INFY.NS';
    } elseif ($marketUpper === 'UK') {
        $marketName = 'London Stock Exchange (LSE)';
        $currency = 'GBP';
        $marketLabel = 'LSE London';
        $sellMari = '- *Should I sell BP.L?*';
        $whySys = '- *Why did VOD.L fall today?*';
        $cementCo = '- *Find undervalued energy companies.*';
        $defStocks = '- *Which stocks benefit from lower corporate taxes?*';
        $dividendP = '- *Build me a UK defensive portfolio.*';
        $defaultStockEx = 'BP.L, HSBA.L, or AZN.L';
    }

    // 1. Specific stock buy/sell queries
    $tickerInQuery = null;
    foreach (preg_split('/\s+/', $query) as $word) {
        $cleaned = strtoupper(trim($word, "?,.!:()"));
        if (strlen($cleaned) >= 2 && (ctype_alpha($cleaned) || strpos($cleaned, '.') !== false) && !isset($stopWords[$cleaned])) {
            $tickerInQuery = $cleaned;
            break;
        }
    }

    if ($tickerInQuery) {
        $info = stock_profiles()[$tickerInQuery] ?? null;
        if ($info) {
            $price = $info['current_price'];
            $pe = $info['pe_ratio'];
            $div = $info['div_yield'];

            if (strpos($queryLower, 'sell') !== false) {
                return "### Analyst Assessment for selling **{$tickerInQuery}** ({$info['name']}):\n\n"
                    . "**{$tickerInQuery}** is currently trading at around **{$currency} {$price}** (P/E of {$pe}x).\n\n"
                    . "**Hold/Sell Rationale:**\n"
                    . "- If you are holding **{$tickerInQuery}** for **dividends** ({$div}% yield), it remains a strong holding. "
                    . "Selling now would mean sacrificing consistent payouts, particularly since interest rates and industry margins are stabilizing.\n"
                    . "- *Short-term trading:* If you have met your targets (around 8-10% capital gain), taking partial profit is sensible, "
                    . "as momentum indicators suggest mild consolidation ahead. However, a complete exit is not recommended unless technical support is broken.";
            }
            if (strpos($queryLower, 'buy') !== false || strpos($queryLower, 'should i') !== false || strpos($queryLower, 'analyze') !== false || strpos($queryLower, 'opinion') !== false) {
                $firstNews = $info['recent_news'][0] ?? ['title' => 'No recent headlines available', 'source' => 'N/A'];
                return "### Investment Analysis: **{$tickerInQuery}** ({$info['name']})\n\n"
                    . "- **Current Valuation:** {$currency} {$price} | P/E: {$pe}x | Dividend Yield: {$div}%\n"
                    . "- **Sector:** {$info['sector']}\n\n"
                    . "**Key Insights:**\n"
                    . "1. **Fundamentals:** {$info['description']}\n"
                    . "2. **Recent News:** {$firstNews['title']} ({$firstNews['source']}).\n"
                    . "3. **Recommendation Summary:** We advise a gradual accumulation at support levels. "
                    . "The technical setup indicates the stock is preparing for a breakout, backed by solid financial statements and volume expansion.";
            }
        } else {
            if (strpos($queryLower, 'sell') !== false) {
                return "### Analyst Assessment for selling **{$tickerInQuery}**:\n\n"
                    . "**{$tickerInQuery}** is currently in consolidation phase ({$marketLabel}).\n\n"
                    . "**Hold/Sell Rationale:**\n"
                    . "- If you are holding **{$tickerInQuery}** for long-term fundamentals, it remains a sound holding. "
                    . "Selling now would mean sacrificing potential capital gains or dividend yields.\n"
                    . "- *Short-term trading:* If you have met your targets (around 8-10% gain), taking partial profit is sensible, "
                    . "as momentum indicators suggest mild consolidation ahead. However, a complete exit is not recommended unless key technical support is broken.";
            }
            if (strpos($queryLower, 'buy') !== false || strpos($queryLower, 'should i') !== false || strpos($queryLower, 'analyze') !== false || strpos($queryLower, 'opinion') !== false) {
                return "### Investment Analysis: **{$tickerInQuery}**\n\n"
                    . "- **Sector:** Global Equity / Selected Sector\n"
                    . "- **Exchange:** {$marketName}\n\n"
                    . "**Key Insights:**\n"
                    . "1. **Fundamentals:** Solid balance sheet with stable performance markers in {$marketLabel}.\n"
                    . "2. **Valuation:** Trading close to its industry average valuation metrics.\n"
                    . "3. **Recommendation Summary:** We advise a gradual accumulation at support levels. "
                    . "The technical setup indicates the stock is preparing for a breakout, backed by solid financial statements and volume expansion.";
            }
        }
    }

    // 2. Portfolio compilation query
    $isPortfolioBlend = strpos($queryLower, 'portfolio') !== false && (strpos($queryLower, 'dividend') !== false || strpos($queryLower, 'tech') !== false || strpos($queryLower, 'growth') !== false);
    if ($isPortfolioBlend) {
        // fall through to dividend portfolio logic below
    } elseif (strpos($queryLower, 'dividend portfolio') !== false || strpos($queryLower, 'tech portfolio') !== false || strpos($queryLower, 'growth portfolio') !== false) {
        $isPortfolioBlend = true;
    }
    if ($isPortfolioBlend) {
        if ($marketUpper === 'US') {
            return "### Recommended US High-Yield / Growth Portfolio\n\n"
                . "To build a robust US portfolio, we select companies with strong cash flows, low debt-to-equity, and solid yields or growth:\n\n"
                . "| Ticker | Company Name | Sector | Recommendation |\n"
                . "| :--- | :--- | :--- | :--- |\n"
                . "| **AAPL** | Apple Inc. | Technology | **30% Weight** (Stable Anchor) |\n"
                . "| **MSFT** | Microsoft Corp. | Technology | **25% Weight** (AI Leader) |\n"
                . "| **AMZN** | Amazon.com Inc. | Consumer Cyclical | **25% Weight** (Retail/Cloud) |\n"
                . "| **TSLA** | Tesla, Inc. | Automotive | **20% Weight** (High Growth) |\n";
        }
        if ($marketUpper === 'IN') {
            return "### Recommended Indian Dividend / Growth Portfolio\n\n"
                . "| Ticker | Company Name | Sector | Recommendation |\n"
                . "| :--- | :--- | :--- | :--- |\n"
                . "| **RELIANCE.NS** | Reliance Industries | Energy | **30% Weight** |\n"
                . "| **TCS.NS** | Tata Consultancy Services | Tech Services | **25% Weight** |\n"
                . "| **INFY.NS** | Infosys Limited | Tech Services | **25% Weight** |\n"
                . "| **HDFCBANK.NS** | HDFC Bank Limited | Financials | **20% Weight** |\n";
        }
        if ($marketUpper === 'UK') {
            return "### Recommended UK High-Yield Portfolio\n\n"
                . "| Ticker | Company Name | Sector | Recommendation |\n"
                . "| :--- | :--- | :--- | :--- |\n"
                . "| **BP.L** | BP p.l.c. | Energy | **35% Weight** |\n"
                . "| **HSBA.L** | HSBC Holdings plc | Financials | **30% Weight** |\n"
                . "| **GSK.L** | GSK plc | Healthcare | **20% Weight** |\n"
                . "| **VOD.L** | Vodafone Group | Telecom | **15% Weight** |\n";
        }
        return "### Recommended PSX High-Yield Dividend Portfolio\n\n"
            . "To build a robust income portfolio, we select companies with strong cash flows, low debt-to-equity, and high dividend payouts:\n\n"
            . "| Ticker | Company Name | Sector | Div. Yield | Recommended Weight |\n"
            . "| :--- | :--- | :--- | :--- | :--- |\n"
            . "| **UBL** | United Bank Limited | Commercial Banks | 15.7% | **30%** |\n"
            . "| **EFERT** | Engro Fertilizers Limited | Fertilizer | 14.8% | **25%** |\n"
            . "| **FFC** | Fauji Fertilizer Company | Fertilizer | 14.1% | **25%** |\n"
            . "| **ENGRO** | Engro Corporation Limited | Conglomerates | 12.7% | **20%** |\n\n"
            . "**Portfolio Highlights:**\n"
            . "- **Average Dividend Yield:** ~14.3%\n"
            . "- **Risk Profile:** Low-to-Medium (Defensive sectors)\n"
            . "- **Strategy:** Reinvest dividends during price consolidations to compound returns. These sectors act as excellent inflation hedges in Pakistan.";
    }

    // 3. Macro question: interest rates / policy
    if (strpos($queryLower, 'interest rate') !== false || strpos($queryLower, 'monetary policy') !== false || strpos($queryLower, 'lower rate') !== false || strpos($queryLower, 'inflation') !== false) {
        if ($marketUpper === 'US') {
            return "### Macro Analysis: Impact of Federal Reserve Policies on US Markets\n\n"
                . "US stock markets are highly sensitive to Federal Reserve interest rate moves and inflation metrics:\n\n"
                . "1. **Winners (Growth & Tech Stocks):**\n"
                . "   - **Tech (AAPL, MSFT):** Growth companies have high valuations based on future cash flows. Lower discount rates directly lift their net present value.\n"
                . "   - **Autos & Consumer Discretionary (TSLA):** Boosts demand for auto loans and retail credit.\n\n"
                . "2. **Losers (Value & Cash Havens):**\n"
                . "   - **Treasuries & Money Market Funds:** Yields contract, pushing capital back into equities.";
        }
        return "### Macro Analysis: Impact of Lower Interest Rates on PSX Sectors\n\n"
            . "A reduction in the State Bank of Pakistan (SBP) policy rate has a profound impact across sectors:\n\n"
            . "1. **Winners (Highly Leveraged & Cyclical Sectors):**\n"
            . "   - **Cement (LUCK, DGKC):** Cement manufacturers have high debt-servicing costs. Lower rates directly boost bottom-line margins. Construction demand also expands.\n"
            . "   - **Steel & Engineering:** Direct reduction in financial finance charges.\n"
            . "   - **Textiles & Autos:** Boosts consumer financing and lowers working capital costs.\n\n"
            . "2. **Losers (Commercial Banks):**\n"
            . "   - **Banks (UBL, HBL):** Bank margins (Net Interest Margins - NIMs) contract as yields on government securities (T-Bills, PIBs) decline. High-yield banking stocks might see short-term profit-taking.\n\n"
            . "**Strategic Advice:** Shift allocation from heavy banking positions toward high-quality Cement (like **LUCK**) and consumer-cyclicals to capture the expansionary cycle.";
    }

    // 4. Sector comparison: undervalued companies
    if (strpos($queryLower, 'cement') !== false || strpos($queryLower, 'undervalued') !== false) {
        if ($marketUpper === 'US') {
            return "### Sector Screening: Tech Underdogs Analysis (Intel vs. AMD)\n\n"
                . "The semiconductor sector is currently in a transition phase. Here is a comparative valuation:\n\n"
                . "- **AMD (AMD):** High growth, massive AI GPU expansion, but premium valuation.\n"
                . "- **Intel (INTC):** Trading at a discount to book value, restructuring, high operational leverage but currently low margins.\n\n"
                . "**Verdict:** AMD is the safer, momentum-focused play. INTC offers value tactical upside if their foundry expansion succeeds.";
        }
        return "### Sector Screening: Cement Sector Analysis (LUCK vs. DGKC)\n\n"
            . "The cement sector is currently in a transition phase. Here is a comparative valuation:\n\n"
            . "- **Lucky Cement (LUCK):**\n"
            . "  - *Valuation:* PKR 780.0 | P/E: 5.9x | ROE: 17.5% | P/B: 1.1x\n"
            . "  - *Pros:* Highly diversified (KIA Motors, power generation), net-cash balance sheet, export capability. Outstanding operational efficiency.\n\n"
            . "- **D.G. Khan Cement (DGKC):**\n"
            . "  - *Valuation:* PKR 72.5 | P/E: 12.4x | ROE: 5.2% | P/B: 0.4x\n"
            . "  - *Pros:* Trading at a deep 60% discount to book value (P/B 0.4). High operational leverage.\n"
            . "  - *Cons:* High debt levels make it highly sensitive to finance costs.\n\n"
            . "**Verdict:** **LUCK** is the safer, fundamentally superior bet. However, for a high-beta trade playing on interest rate cuts, **DGKC** offers massive tactical upside.";
    }

    // 5. Why did a stock fall
    if (strpos($queryLower, 'why did') !== false || strpos($queryLower, 'fall today') !== false || strpos($queryLower, 'fell today') !== false) {
        $matchingTicker = 'the stock';
        foreach (preg_split('/\s+/', $query) as $word) {
            $cleaned = strtoupper(trim($word, "?,.!:()"));
            if (strlen($cleaned) >= 2 && (ctype_alpha($cleaned) || strpos($cleaned, '.') !== false) && !isset($stopWords[$cleaned])) {
                $matchingTicker = $cleaned;
                break;
            }
        }

        return "### Market Commentary: Price Action on **{$matchingTicker}**\n\n"
            . "The recent decline in **{$matchingTicker}** is primarily attributed to:\n"
            . "1. **Macro Profit-Taking:** Major indices in {$marketName} have hovered near resistance, prompting institutional fund managers to trim positions and lock in gains.\n"
            . "2. **Global Sentiment Shift:** High inflation indexes and commodity fluctuations have temporarily dampened sentiments.\n"
            . "3. **Technical Correction:** The stock reached overbought levels, triggering profit-booking.\n\n"
            . "*Recommendation:* The long-term structural bull run remains intact. Treat these corrections as accumulation windows.";
    }

    // 6. Analyze my portfolio query
    if (strpos($queryLower, 'portfolio') !== false) {
        $portfolioSummary = '';
        if ($portfolio && count($portfolio) > 0) {
            $portfolioSummary = "Based on your current holdings:\n\n";
            $totalVal = 0.0;
            foreach ($portfolio as $item) {
                $t = strtoupper($item['ticker'] ?? '');
                $shares = $item['quantity'] ?? ($item['shares'] ?? 0);
                $p = $item['avgPrice'] ?? 100.0;
                $val = $shares * $p;
                $totalVal += $val;
                $portfolioSummary .= "- **{$t}**: {$shares} shares worth **{$currency} " . number_format($val, 2) . "**\n";
            }
            $portfolioSummary .= "\n**Total Portfolio Value:** {$currency} " . number_format($totalVal, 2) . "\n\n";
        } else {
            $portfolioSummary = "You haven't simulated a portfolio yet. You can add stocks like **{$defaultStockEx}** to your portfolio tracker.\n\n";
        }

        return "### Portfolio Risk & Diversification Report\n\n"
            . $portfolioSummary
            . "**Portfolio Diagnostics:**\n"
            . "- **Sector Concentration:** Check if you are overly exposed to a single industry (diversification lowers risk).\n"
            . "- **Dividend Yield Projection:** Focus on defensive dividend payers if you require regular cash-inflows.\n"
            . "- **Growth Drivers:** Keep high-beta growth engines to compound asset value.\n\n"
            . "Need specific shifts? Let me know which stock you want to swap!";
    }

    // General fallback
    return "### {$marketName} AI Advisory Assistant\n\n"
        . "I can help you analyze {$marketLabel} stocks, suggest portfolio allocations, or explain market moves. "
        . "Try asking me questions like:\n"
        . "{$sellMari}\n"
        . "{$dividendP}\n"
        . "{$whySys}\n"
        . "{$cementCo}\n";
}

/** Evaluates the simulated portfolio and returns an AI recommendation report (LLM, falls back to rules). */
function get_portfolio_recommendation(array $portfolioSummary, string $market = 'PK'): array
{
    $marketUpper = strtoupper($market);
    [$currencySymbol, $exchangeName] = market_currency_and_exchange($marketUpper);

    $defaultPromptTemplate = "You are a premier quantitative financial analyst and portfolio manager advising a retail investor on their {exchange_name} portfolio.\nAnalyze the following portfolio summary details and return a structured JSON response evaluating its risk, performance, diversification, and actionable rebalancing.";
    $customIntro = load_custom_prompt('portfolio_prompt', $defaultPromptTemplate);
    $formattedIntro = str_replace('{exchange_name}', $exchangeName, $customIntro);
    $summaryJson = json_encode($portfolioSummary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $buildPrompt = function () use ($formattedIntro, $summaryJson) {
        return <<<PROMPT
        {$formattedIntro}

        Portfolio Summary JSON:
        {$summaryJson}

        Format your response in this exact JSON structure:
        {
            "health_score": <an integer between 10 and 100 based on diversification, quality, and risk>,
            "diversification_rating": "Well Diversified" or "Moderate Concentration" or "High Concentration",
            "analysis_bullets": [
                "Bullet 1: Evaluation of sector allocation and risk factors",
                "Bullet 2: Evaluation of returns (P&L) and stock quality",
                "Bullet 3: Analysis of yield or volatility exposure"
            ],
            "rebalancing_actions": [
                "Suggestion 1: Sell or reduce [Ticker] to lower exposure if concentration is high",
                "Suggestion 2: Buy or allocate to [Ticker] to capture growth or yield",
                "Suggestion 3: Strategic entry target/cash hedge allocation advice"
            ]
        }

        Provide ONLY the raw JSON block without markdown code fences.
        PROMPT;
    };

    if (ai_has_gemini()) {
        $text = gemini_generate_text($buildPrompt());
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
    }

    if (ai_has_openai()) {
        $text = openai_generate_text($buildPrompt(), 'You are a professional financial advisor. Return only valid raw JSON.');
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
    }

    // Fallback to rules-based simulator
    $holdings = $portfolioSummary['holdings'] ?? [];
    $holdingsCount = count($holdings);
    if ($holdingsCount >= 5) {
        $divRating = 'Well Diversified';
        $divScore = 90;
    } elseif ($holdingsCount >= 3) {
        $divRating = 'Moderate Concentration';
        $divScore = 75;
    } else {
        $divRating = 'High Concentration';
        $divScore = 55;
    }

    $hasHeavySector = false;
    foreach (($portfolioSummary['sector_allocation'] ?? []) as $weight) {
        if ($weight > 50) {
            $hasHeavySector = true;
        }
    }

    $pnl = $portfolioSummary['total_pnl'] ?? 0.0;

    $score = $divScore;
    if ($pnl > 0) {
        $score += 10;
    }
    if ($hasHeavySector) {
        $score -= 15;
    }
    $score = max(10, min(100, $score));

    $sectorCount = count($portfolioSummary['sector_allocation'] ?? []);
    $bullets = [
        "Portfolio contains {$holdingsCount} active holdings across {$sectorCount} sector(s).",
        "Your current return stance is " . ($pnl >= 0 ? 'positive' : 'negative') . " with a net return of {$currencySymbol} " . number_format($pnl, 1) . " ({$portfolioSummary['total_pnl_percent']}%).",
    ];
    if ($hasHeavySector) {
        $bullets[] = 'WARNING: High sector concentration detected (>50% in a single area), exposing you to focused sector shocks.';
    } else {
        $bullets[] = 'Good sector allocation balance. Volatility risk is spread across multiple industry segments.';
    }

    if ($marketUpper === 'US') {
        $suggestedStocks = 'AAPL or MSFT';
        $defensiveSectors = 'Technology or Retail';
    } elseif ($marketUpper === 'IN') {
        $suggestedStocks = 'RELIANCE or TCS';
        $defensiveSectors = 'Energy or Technology';
    } elseif ($marketUpper === 'UK') {
        $suggestedStocks = 'BP or HSBA';
        $defensiveSectors = 'Energy or Financial Services';
    } else {
        $suggestedStocks = 'MARI or MEBL';
        $defensiveSectors = 'Commercial Banks or Fertilizers';
    }

    $actions = [
        "Maintain cash reserves of 10-15% to take advantage of buying dips on high-quality stocks like {$suggestedStocks}.",
        'Consider reinvesting dividend gains to leverage the power of compound interest.',
    ];
    if ($hasHeavySector) {
        array_unshift($actions, "Reduce weighting in your highly concentrated sectors and redistribute funds into defensive sectors (like {$defensiveSectors}).");
    } else {
        array_unshift($actions, 'No urgent rebalancing needed. Continue monitoring quarterly earnings announcements for any fundamental change.');
    }

    return [
        'health_score' => $score,
        'diversification_rating' => $divRating,
        'analysis_bullets' => $bullets,
        'rebalancing_actions' => $actions,
    ];
}

/** Main entry point for chat queries. Uses LLM if configured, otherwise falls back to the rule-based parser. */
function query_chat_advisor(string $query, ?string $tickerContext = null, ?array $portfolio = null, string $market = 'PK'): string
{
    $marketUpper = strtoupper($market ?: 'PK');
    $marketName = 'Pakistan Stock Exchange (PSX)';
    if ($marketUpper === 'US') {
        $marketName = 'US Stock Markets (NYSE/NASDAQ)';
    } elseif ($marketUpper === 'IN') {
        $marketName = 'National Stock Exchange of India (NSE)';
    } elseif ($marketUpper === 'UK') {
        $marketName = 'London Stock Exchange (LSE)';
    }

    $context = $tickerContext ? "Context: User is analyzing stock: {$tickerContext} in the {$marketUpper} market. " : '';
    if ($portfolio) {
        $context .= 'User\'s current simulated portfolio: ' . json_encode($portfolio, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '. ';
    }

    $defaultChatTemplate = "You are a professional financial advisor for {market_name}.\n{context}\nUser asks: '{query}'\n\nProvide a clear, detailed, professional answer in markdown. Mention tickers, numbers, and structural arguments (inflation, interest rates, earnings) where relevant.";
    $customChat = load_custom_prompt('chat_prompt', $defaultChatTemplate);
    $prompt = str_replace(['{market_name}', '{context}', '{query}'], [$marketName, $context, $query], $customChat);

    if (ai_has_gemini()) {
        $text = gemini_generate_text($prompt);
        if ($text !== null) {
            return $text;
        }
    }

    if (ai_has_openai()) {
        $text = openai_generate_text($prompt, "You are a professional financial advisor for {$marketName}.");
        if ($text !== null) {
            return $text;
        }
    }

    return generate_simulator_chat_response($query, $portfolio, $market);
}

/**
 * Summarizes today's real news headlines and macro data into a short
 * AI-written market pulse. Never quotes an individual simulated stock
 * price — only reasons over real news/macro data.
 */
function get_market_digest(array $newsItems, array $macroData, string $market = 'PK', ?string $marketName = null): array
{
    $marketUpper = strtoupper($market);
    $marketName = $marketName ?: $marketUpper;

    $headlines = [];
    foreach (array_slice($newsItems, 0, 10) as $item) {
        if (!empty($item['title'])) {
            $headlines[] = $item['title'];
        }
    }

    $digestInput = ['headlines' => $headlines, 'macro' => $macroData ?: new stdClass()];

    $fallback = [
        'sentiment' => 'Mixed',
        'summary' => "Market sentiment for {$marketName} is being shaped by a mix of headlines today — see the stories below for details.",
        'themes' => $headlines ? array_map(fn($h) => substr($h, 0, 80), array_slice($headlines, 0, 3)) : ['No major headlines available right now.'],
    ];

    $digestJson = json_encode($digestInput, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    $buildPrompt = function () use ($marketName, $digestJson) {
        return <<<PROMPT
        You are a financial news analyst summarizing today's market mood for a retail investor
        following the {$marketName} market. Do not invent or state specific stock prices — you
        only have access to news headlines and macro data (forex/commodities/index), not live
        stock quotes.

        Data:
        {$digestJson}

        Return ONLY raw JSON in this exact structure:
        {
            "sentiment": "Bullish" or "Bearish" or "Mixed",
            "summary": "2-3 sentence plain-language summary of what's moving sentiment today",
            "themes": ["Theme 1 grounded in a headline", "Theme 2", "Theme 3"]
        }
        PROMPT;
    };

    if (ai_has_gemini()) {
        $text = gemini_generate_text($buildPrompt());
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
    }

    if (ai_has_openai()) {
        $text = openai_generate_text($buildPrompt(), 'You are a financial news analyst. Return only valid raw JSON.');
        if ($text !== null) {
            $decoded = json_decode(strip_json_fence($text), true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
    }

    return $fallback;
}
