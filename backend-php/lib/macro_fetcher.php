<?php
/**
 * Ported from backend/macro_fetcher.py. Real forex + commodity spot data
 * (not PSX/exchange stock data — no data-licensing concerns here), with a
 * KSE-100 index level that stays simulated (see note near get_macro_indicators)
 * because PSX's index level is covered by its market-data licensing notice.
 *
 * Divergence: Python used yfinance for commodity/index history; this port
 * calls Yahoo Finance's public chart JSON endpoint directly via curl
 * (https://query1.finance.yahoo.com/v8/finance/chart/{symbol}) since
 * yfinance itself is a Python package. Response shape returned to the
 * mobile app is unchanged.
 */

declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const NISAB_GOLD_GRAMS = 87.48;
const NISAB_SILVER_GRAMS = 612.36;

function currency_symbols(): array
{
    return ['PK' => 'Rs.', 'US' => '$', 'IN' => '₹', 'UK' => '£', 'CA' => 'C$'];
}

function currency_codes(): array
{
    return ['PK' => 'PKR', 'US' => 'USD', 'IN' => 'INR', 'UK' => 'GBP', 'CA' => 'CAD'];
}

/** Fetches (or returns cached) USD-based exchange rates for all currencies. */
function get_forex_rates_dict(): array
{
    $cached = cache_get('forex', 'rates', 3600); // 1 hour
    if ($cached !== null) {
        return $cached;
    }

    $fallback = ['PKR' => 278.4, 'INR' => 83.5, 'EUR' => 0.92, 'GBP' => 0.78, 'JPY' => 154.0, 'AED' => 3.67, 'CAD' => 1.37, 'TRY' => 33.5];

    try {
        $resp = http_get('https://open.er-api.com/v6/latest/USD', ['User-Agent: Mozilla/5.0'], 10.0);
        if ($resp && $resp['status'] === 200) {
            $data = json_decode($resp['body'], true);
            if (is_array($data) && isset($data['rates']) && is_array($data['rates'])) {
                cache_set('forex', 'rates', $data['rates'], 10);
                return $data['rates'];
            }
        }
    } catch (Throwable $e) {
        // fall through to stale cache / fallback
    }

    $stale = cache_get_stale('forex', 'rates');
    if (is_array($stale)) {
        return $stale;
    }
    return $fallback;
}

/** Fetches a symbol's latest close and previous close via Yahoo Finance's public chart JSON endpoint. */
function yahoo_quote(string $symbol): ?array
{
    $url = 'https://query1.finance.yahoo.com/v8/finance/chart/' . rawurlencode($symbol) . '?range=5d&interval=1d';
    $resp = http_get($url, ['User-Agent: ' . NEWS_USER_AGENT], 10.0);
    if (!$resp || $resp['status'] !== 200) {
        return null;
    }
    $data = json_decode($resp['body'], true);
    $closes = $data['chart']['result'][0]['indicators']['quote'][0]['close'] ?? null;
    if (!is_array($closes)) {
        return null;
    }
    $closes = array_values(array_filter($closes, fn($v) => $v !== null));
    if (count($closes) === 0) {
        return null;
    }
    $current = (float)end($closes);
    $prev = count($closes) > 1 ? (float)$closes[count($closes) - 2] : $current;
    return ['current' => $current, 'prev' => $prev];
}

/** Fetches (or returns cached) Gold/Silver/Crude Oil USD spot prices. */
function get_commodity_list(): array
{
    $cached = cache_get('commodities', 'list', 900); // 15 minutes
    if ($cached !== null) {
        return $cached;
    }

    $tickersMap = ['Gold' => 'GC=F', 'Silver' => 'SI=F', 'Crude Oil' => 'CL=F'];
    $commodityList = [];

    foreach ($tickersMap as $name => $ticker) {
        try {
            $q = yahoo_quote($ticker);
            if ($q) {
                $change = $q['current'] - $q['prev'];
                $pct = $q['prev'] != 0 ? ($change / $q['prev']) * 100 : 0.0;
                $commodityList[] = [
                    'name' => $name,
                    'ticker' => $ticker,
                    'price' => round($q['current'], 2),
                    'change' => round($change, 2),
                    'pct_change' => round($pct, 2),
                ];
            }
        } catch (Throwable $e) {
            // skip this commodity, keep going
        }
    }

    if (count($commodityList) > 0) {
        cache_set('commodities', 'list', $commodityList, 10);
        return $commodityList;
    }

    return [
        ['name' => 'Gold', 'ticker' => 'GC=F', 'price' => 2385.4, 'change' => 10.7, 'pct_change' => 0.45],
        ['name' => 'Silver', 'ticker' => 'SI=F', 'price' => 27.8, 'change' => 0.15, 'pct_change' => 0.54],
        ['name' => 'Crude Oil', 'ticker' => 'CL=F', 'price' => 78.4, 'change' => -0.85, 'pct_change' => -1.07],
    ];
}

function get_all_forex_rates(): array
{
    return get_forex_rates_dict();
}

/**
 * Computes the current Nisab thresholds (gold & silver standard) in the
 * local currency, from real gold/silver spot prices and forex rates. This
 * is a general estimate for convenience only, not a religious ruling.
 */
function get_zakat_nisab(string $market = 'PK'): array
{
    $marketUpper = strtoupper($market ?: 'PK');
    $currencySymbol = currency_symbols()[$marketUpper] ?? 'Rs.';
    $currencyCode = currency_codes()[$marketUpper] ?? 'PKR';

    $forexRates = get_forex_rates_dict();
    $usdToLocal = $currencyCode === 'USD' ? 1.0 : ($forexRates[$currencyCode] ?? 1.0);

    $commodities = [];
    foreach (get_commodity_list() as $c) {
        $commodities[$c['name']] = $c['price'];
    }
    $goldUsdPerOz = $commodities['Gold'] ?? 2385.4;
    $silverUsdPerOz = $commodities['Silver'] ?? 27.8;

    $goldPerGramLocal = ($goldUsdPerOz / GRAMS_PER_TROY_OUNCE) * $usdToLocal;
    $silverPerGramLocal = ($silverUsdPerOz / GRAMS_PER_TROY_OUNCE) * $usdToLocal;

    $nisabGold = $goldPerGramLocal * NISAB_GOLD_GRAMS;
    $nisabSilver = $silverPerGramLocal * NISAB_SILVER_GRAMS;

    return [
        'currency_symbol' => $currencySymbol,
        'currency_code' => $currencyCode,
        'gold_price_per_gram' => round($goldPerGramLocal, 2),
        'silver_price_per_gram' => round($silverPerGramLocal, 2),
        'nisab_gold_threshold' => round($nisabGold, 2),
        'nisab_silver_threshold' => round($nisabSilver, 2),
        'nisab_gold_grams' => NISAB_GOLD_GRAMS,
        'nisab_silver_grams' => NISAB_SILVER_GRAMS,
        'zakat_rate_percent' => 2.5,
    ];
}

function fmt_num(float $n, int $decimals): string
{
    return number_format(round($n, $decimals), $decimals);
}

/**
 * Fetches real-time commodity futures (Gold, Silver, WTI Crude Oil) and
 * Forex currency pairs based on the selected market tab. Converts the
 * gold rate into localized weight units (Tola/gram) per market.
 */
function get_macro_indicators(string $market = 'PK', string $indexSymbol = '^KSE', string $indexName = 'KSE100'): array
{
    $market = strtoupper($market ?: 'PK');

    $forex = get_forex_rates_dict();
    $usdPkr = $forex['PKR'] ?? 278.4;
    $usdInr = $forex['INR'] ?? 83.5;
    $usdEur = $forex['EUR'] ?? 0.92;
    $usdGbp = $forex['GBP'] ?? 0.78;
    $usdJpy = $forex['JPY'] ?? 154.0;
    $usdAed = $forex['AED'] ?? 3.67;
    $usdCad = $forex['CAD'] ?? 1.37;

    $forexList = [];
    switch ($market) {
        case 'PK':
            $forexList = [
                ['pair' => 'USD/PKR', 'rate' => round($usdPkr, 2)],
                ['pair' => 'GBP/PKR', 'rate' => round($usdPkr / $usdGbp, 2)],
                ['pair' => 'EUR/PKR', 'rate' => round($usdPkr / $usdEur, 2)],
                ['pair' => 'AED/PKR', 'rate' => round($usdPkr / $usdAed, 2)],
            ];
            break;
        case 'IN':
            $forexList = [
                ['pair' => 'USD/INR', 'rate' => round($usdInr, 2)],
                ['pair' => 'EUR/INR', 'rate' => round($usdInr / $usdEur, 2)],
                ['pair' => 'GBP/INR', 'rate' => round($usdInr / $usdGbp, 2)],
                ['pair' => 'AED/INR', 'rate' => round($usdInr / $usdAed, 2)],
            ];
            break;
        case 'UK':
            $forexList = [
                ['pair' => 'GBP/USD', 'rate' => round(1.0 / $usdGbp, 3)],
                ['pair' => 'EUR/GBP', 'rate' => round($usdGbp / $usdEur, 3)],
                ['pair' => 'USD/JPY', 'rate' => round($usdJpy, 2)],
                ['pair' => 'GBP/EUR', 'rate' => round($usdEur / $usdGbp, 3)],
            ];
            break;
        case 'CA':
            $forexList = [
                ['pair' => 'USD/CAD', 'rate' => round($usdCad, 3)],
                ['pair' => 'EUR/CAD', 'rate' => round($usdCad / $usdEur, 3)],
                ['pair' => 'GBP/CAD', 'rate' => round($usdCad / $usdGbp, 3)],
                ['pair' => 'CAD/USD', 'rate' => round(1.0 / $usdCad, 3)],
            ];
            break;
        case 'JP':
            $forexList = [
                ['pair' => 'USD/JPY', 'rate' => round($usdJpy, 2)],
                ['pair' => 'EUR/JPY', 'rate' => round($usdJpy / $usdEur, 2)],
                ['pair' => 'GBP/JPY', 'rate' => round($usdJpy / $usdGbp, 2)],
                ['pair' => 'CAD/JPY', 'rate' => round($usdJpy / $usdCad, 2)],
            ];
            break;
        case 'DE':
            $forexList = [
                ['pair' => 'EUR/USD', 'rate' => round(1.0 / $usdEur, 3)],
                ['pair' => 'GBP/EUR', 'rate' => round($usdEur / $usdGbp, 3)],
                ['pair' => 'EUR/JPY', 'rate' => round($usdJpy / $usdEur, 2)],
                ['pair' => 'EUR/CHF', 'rate' => round(($forex['CHF'] ?? 0.90) / $usdEur, 3)],
            ];
            break;
        case 'AU':
            $usdAud = $forex['AUD'] ?? 1.50;
            $forexList = [
                ['pair' => 'AUD/USD', 'rate' => round(1.0 / $usdAud, 3)],
                ['pair' => 'USD/AUD', 'rate' => round($usdAud, 3)],
                ['pair' => 'EUR/AUD', 'rate' => round($usdAud / $usdEur, 3)],
                ['pair' => 'GBP/AUD', 'rate' => round($usdAud / $usdGbp, 3)],
            ];
            break;
        case 'SA':
            $usdSar = $forex['SAR'] ?? 3.75;
            $forexList = [
                ['pair' => 'USD/SAR', 'rate' => round($usdSar, 2)],
                ['pair' => 'EUR/SAR', 'rate' => round($usdSar / $usdEur, 2)],
                ['pair' => 'GBP/SAR', 'rate' => round($usdSar / $usdGbp, 2)],
                ['pair' => 'AED/SAR', 'rate' => round($usdSar / $usdAed, 3)],
            ];
            break;
        case 'AE':
            $forexList = [
                ['pair' => 'USD/AED', 'rate' => round($usdAed, 2)],
                ['pair' => 'EUR/AED', 'rate' => round($usdAed / $usdEur, 2)],
                ['pair' => 'GBP/AED', 'rate' => round($usdAed / $usdGbp, 2)],
                ['pair' => 'SAR/AED', 'rate' => round($usdAed / ($forex['SAR'] ?? 3.75), 3)],
            ];
            break;
        case 'CN':
            $usdCny = $forex['CNY'] ?? 7.25;
            $forexList = [
                ['pair' => 'USD/CNY', 'rate' => round($usdCny, 3)],
                ['pair' => 'EUR/CNY', 'rate' => round($usdCny / $usdEur, 3)],
                ['pair' => 'GBP/CNY', 'rate' => round($usdCny / $usdGbp, 3)],
                ['pair' => 'CNY/HKD', 'rate' => round(($forex['HKD'] ?? 7.80) / $usdCny, 3)],
            ];
            break;
        case 'QA':
            $usdQar = $forex['QAR'] ?? 3.64;
            $forexList = [
                ['pair' => 'USD/QAR', 'rate' => round($usdQar, 3)],
                ['pair' => 'EUR/QAR', 'rate' => round($usdQar / $usdEur, 3)],
                ['pair' => 'GBP/QAR', 'rate' => round($usdQar / $usdGbp, 3)],
                ['pair' => 'AED/QAR', 'rate' => round($usdQar / $usdAed, 3)],
            ];
            break;
        case 'EG':
            $usdEgp = $forex['EGP'] ?? 48.5;
            $forexList = [
                ['pair' => 'USD/EGP', 'rate' => round($usdEgp, 2)],
                ['pair' => 'EUR/EGP', 'rate' => round($usdEgp / $usdEur, 2)],
                ['pair' => 'GBP/EGP', 'rate' => round($usdEgp / $usdGbp, 2)],
                ['pair' => 'SAR/EGP', 'rate' => round($usdEgp / ($forex['SAR'] ?? 3.75), 2)],
            ];
            break;
        case 'IR':
            $usdIrr = $forex['IRR'] ?? 42000.0;
            $forexList = [
                ['pair' => 'USD/IRR', 'rate' => round($usdIrr, 1)],
                ['pair' => 'EUR/IRR', 'rate' => round($usdIrr / $usdEur, 1)],
                ['pair' => 'GBP/IRR', 'rate' => round($usdIrr / $usdGbp, 1)],
                ['pair' => 'AED/IRR', 'rate' => round($usdIrr / $usdAed, 1)],
            ];
            break;
        case 'TR':
            $usdTry = $forex['TRY'] ?? 33.5;
            $forexList = [
                ['pair' => 'USD/TRY', 'rate' => round($usdTry, 2)],
                ['pair' => 'EUR/TRY', 'rate' => round($usdTry / $usdEur, 2)],
                ['pair' => 'GBP/TRY', 'rate' => round($usdTry / $usdGbp, 2)],
                ['pair' => 'AED/TRY', 'rate' => round($usdTry / $usdAed, 2)],
            ];
            break;
        default: // US tab
            $forexList = [
                ['pair' => 'EUR/USD', 'rate' => round(1.0 / $usdEur, 3)],
                ['pair' => 'GBP/USD', 'rate' => round(1.0 / $usdGbp, 3)],
                ['pair' => 'USD/JPY', 'rate' => round($usdJpy, 2)],
                ['pair' => 'USD/CAD', 'rate' => round($usdCad, 3)],
            ];
    }

    $commodityList = get_commodity_list();

    foreach ($commodityList as &$item) {
        $name = $item['name'];
        $priceUsd = $item['price'];
        $local = null;

        switch ($market) {
            case 'PK':
                if ($name === 'Gold') {
                    $tola = ($priceUsd / 31.1034768) * 11.6638 * $usdPkr * 1.018;
                    $local = ['label' => 'Gold per Tola', 'price' => 'Rs. ' . number_format(round($tola, -2), 0)];
                } elseif ($name === 'Silver') {
                    $tola = ($priceUsd / 31.1034768) * 11.6638 * $usdPkr * 1.018;
                    $local = ['label' => 'Silver per Tola', 'price' => 'Rs. ' . number_format(round($tola, -1), 0)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdPkr;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => 'Rs. ' . number_format(round($barrel, -2), 0)];
                }
                break;
            case 'IN':
                if ($name === 'Gold') {
                    $tola = ($priceUsd / 31.1034768) * 11.6638 * $usdInr * 1.015;
                    $local = ['label' => 'Gold per Tola', 'price' => '₹' . number_format(round($tola, -1), 0)];
                } elseif ($name === 'Silver') {
                    $tola = ($priceUsd / 31.1034768) * 11.6638 * $usdInr * 1.015;
                    $local = ['label' => 'Silver per Tola', 'price' => '₹' . number_format(round($tola, -1), 0)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdInr;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '₹' . number_format(round($barrel, -1), 0)];
                }
                break;
            case 'UK':
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdGbp;
                    $local = ['label' => 'Gold per Gram', 'price' => '£' . fmt_num($g, 2)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdGbp;
                    $local = ['label' => 'Silver per Gram', 'price' => '£' . fmt_num($g, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdGbp;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '£' . fmt_num($barrel, 2)];
                }
                break;
            case 'CA':
                if ($name === 'Gold') {
                    $oz = $priceUsd * $usdCad;
                    $local = ['label' => 'Gold per oz', 'price' => 'C$' . fmt_num($oz, 2)];
                } elseif ($name === 'Silver') {
                    $oz = $priceUsd * $usdCad;
                    $local = ['label' => 'Silver per oz', 'price' => 'C$' . fmt_num($oz, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdCad;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => 'C$' . fmt_num($barrel, 2)];
                }
                break;
            case 'JP':
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdJpy;
                    $local = ['label' => 'Gold per Gram', 'price' => '¥' . fmt_num($g, 0)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdJpy;
                    $local = ['label' => 'Silver per Gram', 'price' => '¥' . fmt_num($g, 1)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdJpy;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '¥' . fmt_num($barrel, 0)];
                }
                break;
            case 'DE':
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdEur;
                    $local = ['label' => 'Gold per Gram', 'price' => '€' . fmt_num($g, 2)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdEur;
                    $local = ['label' => 'Silver per Gram', 'price' => '€' . fmt_num($g, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdEur;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '€' . fmt_num($barrel, 2)];
                }
                break;
            case 'AU':
                $usdAud = $forex['AUD'] ?? 1.50;
                if ($name === 'Gold') {
                    $oz = $priceUsd * $usdAud;
                    $local = ['label' => 'Gold per oz', 'price' => 'A$' . fmt_num($oz, 2)];
                } elseif ($name === 'Silver') {
                    $oz = $priceUsd * $usdAud;
                    $local = ['label' => 'Silver per oz', 'price' => 'A$' . fmt_num($oz, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdAud;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => 'A$' . fmt_num($barrel, 2)];
                }
                break;
            case 'SA':
                $usdSar = $forex['SAR'] ?? 3.75;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdSar;
                    $local = ['label' => 'Gold per Gram', 'price' => fmt_num($g, 1) . ' SAR'];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdSar;
                    $local = ['label' => 'Silver per Gram', 'price' => fmt_num($g, 2) . ' SAR'];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdSar;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => fmt_num($barrel, 1) . ' SAR'];
                }
                break;
            case 'AE':
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdAed;
                    $local = ['label' => 'Gold per Gram', 'price' => fmt_num($g, 1) . ' AED'];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdAed;
                    $local = ['label' => 'Silver per Gram', 'price' => fmt_num($g, 2) . ' AED'];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdAed;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => fmt_num($barrel, 1) . ' AED'];
                }
                break;
            case 'CN':
                $usdCny = $forex['CNY'] ?? 7.25;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdCny;
                    $local = ['label' => 'Gold per Gram', 'price' => '¥' . fmt_num($g, 1)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdCny;
                    $local = ['label' => 'Silver per Gram', 'price' => '¥' . fmt_num($g, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdCny;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '¥' . fmt_num($barrel, 1)];
                }
                break;
            case 'QA':
                $usdQar = $forex['QAR'] ?? 3.64;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdQar;
                    $local = ['label' => 'Gold per Gram', 'price' => fmt_num($g, 1) . ' QAR'];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdQar;
                    $local = ['label' => 'Silver per Gram', 'price' => fmt_num($g, 2) . ' QAR'];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdQar;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => fmt_num($barrel, 1) . ' QAR'];
                }
                break;
            case 'EG':
                $usdEgp = $forex['EGP'] ?? 48.5;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdEgp;
                    $local = ['label' => 'Gold per Gram', 'price' => 'E£' . fmt_num($g, 1)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdEgp;
                    $local = ['label' => 'Silver per Gram', 'price' => 'E£' . fmt_num($g, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdEgp;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => 'E£' . fmt_num($barrel, 1)];
                }
                break;
            case 'IR':
                $usdIrr = $forex['IRR'] ?? 42000.0;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdIrr;
                    $local = ['label' => 'Gold per Gram', 'price' => fmt_num($g, 0) . ' IRR'];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdIrr;
                    $local = ['label' => 'Silver per Gram', 'price' => fmt_num($g, 0) . ' IRR'];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdIrr;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => fmt_num($barrel, 0) . ' IRR'];
                }
                break;
            case 'TR':
                $usdTry = $forex['TRY'] ?? 33.5;
                if ($name === 'Gold') {
                    $g = ($priceUsd / 31.1034768) * $usdTry;
                    $local = ['label' => 'Gold per Gram', 'price' => '₺' . fmt_num($g, 1)];
                } elseif ($name === 'Silver') {
                    $g = ($priceUsd / 31.1034768) * $usdTry;
                    $local = ['label' => 'Silver per Gram', 'price' => '₺' . fmt_num($g, 2)];
                } elseif ($name === 'Crude Oil') {
                    $barrel = $priceUsd * $usdTry;
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '₺' . fmt_num($barrel, 1)];
                }
                break;
            default: // US tab
                if ($name === 'Gold') {
                    $local = ['label' => 'Gold per oz', 'price' => '$' . fmt_num($priceUsd, 2)];
                } elseif ($name === 'Silver') {
                    $local = ['label' => 'Silver per oz', 'price' => '$' . fmt_num($priceUsd, 2)];
                } elseif ($name === 'Crude Oil') {
                    $local = ['label' => 'Crude Oil per bbl', 'price' => '$' . fmt_num($priceUsd, 2)];
                }
        }

        if ($local !== null) {
            $item['localized'] = $local;
        }
    }
    unset($item);

    // Live index quote. PSX's KSE-100 index level is explicitly covered by
    // its market-data licensing notice, so it is never fetched live here —
    // it always falls through to the simulated fallback value below.
    $indexData = null;
    $indexCacheKey = "$market:$indexSymbol";
    $cachedIndex = cache_get('index', $indexCacheKey, 300); // 5 minutes
    if ($cachedIndex !== null) {
        $indexData = $cachedIndex;
    } elseif ($indexSymbol !== '^KSE') {
        try {
            $q = yahoo_quote($indexSymbol);
            if ($q) {
                $change = $q['current'] - $q['prev'];
                $pctChange = $q['prev'] != 0 ? ($change / $q['prev']) * 100 : 0.0;
                $sign = $change >= 0 ? '+' : '';
                $changeStr = sprintf('%s%s (%s%s%%)', $sign, number_format($change, 2), $sign, number_format($pctChange, 2));

                $indexData = [
                    'name' => $indexName,
                    'symbol' => $indexSymbol,
                    'val' => number_format($q['current'], 2),
                    'change' => $changeStr,
                    'positive' => $change >= 0,
                ];
                cache_set('index', $indexCacheKey, $indexData, 100);
            }
        } catch (Throwable $e) {
            // fall through to fallback below
        }
    }

    if ($indexData === null) {
        $staleIndex = cache_get_stale('index', $indexCacheKey);
        if (is_array($staleIndex)) {
            $indexData = $staleIndex;
        } elseif ($indexSymbol === '^KSE') {
            // KSE-100 is never fetched live (PSX data licensing) — simulate a
            // plausible level with a small random daily move instead.
            $baseVal = 100000.0;
            $pct = rng_uniform(-1.2, 1.5);
            $changeVal = $baseVal * ($pct / 100.0);
            $indexData = [
                'name' => 'KSE100 (Simulated)',
                'symbol' => $indexSymbol,
                'val' => number_format($baseVal + $changeVal, 2),
                'change' => sprintf('%s%s (%s%s%%)', $changeVal >= 0 ? '+' : '', number_format($changeVal, 2), $pct >= 0 ? '+' : '', number_format($pct, 2)),
                'positive' => $changeVal >= 0,
                'simulated' => true,
            ];
        } else {
            $fallbackVals = [
                '^GSPC' => ['name' => 'S&P 500', 'val' => '5,459.10', 'change' => '+48.30 (+0.89%)', 'positive' => true],
                '^NSEI' => ['name' => 'NIFTY 50', 'val' => '24,315.90', 'change' => '+102.50 (+0.42%)', 'positive' => true],
                '^FTSE' => ['name' => 'FTSE 100', 'val' => '8,185.30', 'change' => '-24.10 (-0.29%)', 'positive' => false],
            ];
            $fb = $fallbackVals[$indexSymbol] ?? ['name' => $indexName, 'val' => '0.00', 'change' => '0.00 (0.00%)', 'positive' => true];
            $indexData = [
                'name' => $fb['name'],
                'symbol' => $indexSymbol,
                'val' => $fb['val'],
                'change' => $fb['change'],
                'positive' => $fb['positive'],
            ];
        }
    }

    return [
        'commodities' => $commodityList,
        'forex' => $forexList,
        'index' => $indexData,
        'timestamp' => date('h:i A'),
    ];
}
