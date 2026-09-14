<?php
/**
 * Ported from backend/data_fetcher.py's STOCK_PROFILES.
 *
 * NOTE: This module intentionally does NOT fetch or redistribute real
 * exchange market data. PSX's published data-licensing notice prohibits
 * dissemination of its market data feed (prices, bids/asks, volumes,
 * index levels) through applications without a license. All prices and
 * volumes below are synthetically generated seed data for demonstration
 * purposes only.
 */

declare(strict_types=1);

function stock_profiles(): array
{
    static $profiles = null;
    if ($profiles !== null) {
        return $profiles;
    }

    $profiles = [
        'MARI' => [
            'name' => 'Mari Petroleum Company Limited',
            'sector' => 'Oil & Gas Exploration',
            'current_price' => 710.0,
            'pe_ratio' => 7.8,
            'roe' => 44.5,
            'div_yield' => 6.8,
            'debt_equity' => 12.0,
            'pb_ratio' => 2.4,
            'eps' => 91.0,
            'volume_avg' => 250000,
            'description' => "Mari Petroleum is one of the largest gas exploration and production companies in Pakistan, operating the country's largest gas reservoir at Mari Field. Extremely robust cash flows, high operating margins, and strong government backing.",
            'recent_news' => [
                ['title' => 'Mari Petroleum announces major gas discovery in Sindh', 'sentiment' => 'bullish', 'source' => 'PSX Announcement'],
                ['title' => 'Mari reports 24% growth in quarterly earnings, beats expectations', 'sentiment' => 'bullish', 'source' => 'Financial Times'],
                ['title' => 'International crude oil prices surge amid Middle East tensions, supportive for exploration firms', 'sentiment' => 'bullish', 'source' => 'Bloomberg'],
            ],
        ],
        'SYS' => [
            'name' => 'Systems Limited',
            'sector' => 'Technology (IT Services)',
            'current_price' => 420.0,
            'pe_ratio' => 21.5,
            'roe' => 29.8,
            'div_yield' => 1.6,
            'debt_equity' => 5.4,
            'pb_ratio' => 5.1,
            'eps' => 19.5,
            'volume_avg' => 850000,
            'description' => "Systems Limited is Pakistan's premier IT exporter, providing software development, systems integration, and business process outsourcing. It is heavily exposed to USD earnings, making it a key beneficiary of PKR devaluation.",
            'recent_news' => [
                ['title' => 'Systems Limited expands operations in Saudi Arabia and UAE markets', 'sentiment' => 'bullish', 'source' => 'Business Recorder'],
                ['title' => 'Global tech slowdown fears temporarily pressure export-oriented IT sectors', 'sentiment' => 'bearish', 'source' => 'Dawn News'],
                ['title' => "Systems Ltd wins consecutive Asia's 200 Best Under A Billion award", 'sentiment' => 'bullish', 'source' => 'Forbes'],
            ],
        ],
        'LUCK' => [
            'name' => 'Lucky Cement Limited',
            'sector' => 'Cement',
            'current_price' => 780.0,
            'pe_ratio' => 5.9,
            'roe' => 17.5,
            'div_yield' => 3.2,
            'debt_equity' => 22.0,
            'pb_ratio' => 1.1,
            'eps' => 132.2,
            'volume_avg' => 400000,
            'description' => 'Lucky Cement is the largest cement manufacturer in Pakistan, with diversified interests in power generation, automobiles (KIA Lucky Motors), and mobile phone manufacturing. Highly efficient plants and strong pricing power.',
            'recent_news' => [
                ['title' => 'Lucky Cement reports higher local sales despite construction slowdown', 'sentiment' => 'bullish', 'source' => 'PSX Announcement'],
                ['title' => 'Coal price correction in international market improves gross margins for cement manufacturers', 'sentiment' => 'bullish', 'source' => 'Capital Market Update'],
                ['title' => 'Monetary policy rate hike could impact leveraging costs for industrial sector expansion', 'sentiment' => 'bearish', 'source' => 'State Bank Circular'],
            ],
        ],
        'ENGRO' => [
            'name' => 'Engro Corporation Limited',
            'sector' => 'Conglomerates',
            'current_price' => 315.0,
            'pe_ratio' => 6.1,
            'roe' => 21.4,
            'div_yield' => 12.7,
            'debt_equity' => 45.0,
            'pb_ratio' => 1.3,
            'eps' => 51.6,
            'volume_avg' => 520000,
            'description' => "Engro Corporation is one of Pakistan's largest conglomerates, with business holdings in fertilizers, petrochemicals (PVC), telecommunication infrastructure, food products, and energy. Renowned for consistent high dividend payouts.",
            'recent_news' => [
                ['title' => 'Engro Corp announces bumper interim dividend of PKR 15 per share', 'sentiment' => 'bullish', 'source' => 'Corporate Disclosure'],
                ['title' => 'Petrochemical margins compress globally, impacting chemical subsidiary performance', 'sentiment' => 'bearish', 'source' => 'Reuters Report'],
                ['title' => 'Engro Polymer expansion project goes online on schedule', 'sentiment' => 'bullish', 'source' => 'Engineering News'],
            ],
        ],
        'FFC' => [
            'name' => 'Fauji Fertilizer Company Limited',
            'sector' => 'Fertilizer',
            'current_price' => 142.0,
            'pe_ratio' => 5.4,
            'roe' => 36.2,
            'div_yield' => 14.1,
            'debt_equity' => 18.0,
            'pb_ratio' => 2.1,
            'eps' => 26.3,
            'volume_avg' => 980000,
            'description' => "FFC is the market leader in fertilizer manufacturing, producing the renowned 'Sona Urea' brand. Highly stable cash flows, inelastic product demand, and excellent dividend history make it a classic defensive stock.",
            'recent_news' => [
                ['title' => 'Urea prices remain firm in domestic market amid high demand', 'sentiment' => 'bullish', 'source' => 'Agri News'],
                ['title' => 'FFC records highest ever quarterly urea production volume', 'sentiment' => 'bullish', 'source' => 'Production Update'],
                ['title' => 'Gas pricing policy revisions could increase input raw material cost for fertilizer industry', 'sentiment' => 'bearish', 'source' => 'Ministry of Energy Release'],
            ],
        ],
        'UBL' => [
            'name' => 'United Bank Limited',
            'sector' => 'Commercial Banks',
            'current_price' => 185.0,
            'pe_ratio' => 4.2,
            'roe' => 26.5,
            'div_yield' => 15.7,
            'debt_equity' => 0.0,
            'pb_ratio' => 1.2,
            'eps' => 44.0,
            'volume_avg' => 1200000,
            'description' => "UBL is one of Pakistan's largest commercial banks, with a massive deposit base and extensive domestic and international branch networks. Very high interest rate environment has significantly boosted bank net interest margins.",
            'recent_news' => [
                ['title' => 'UBL declares quarterly payout, maintains position as top dividend payer in banking', 'sentiment' => 'bullish', 'source' => 'Quarterly Report'],
                ['title' => 'State Bank keeps policy rate unchanged at historic high, supporting bank yields', 'sentiment' => 'bullish', 'source' => 'SBP Monetary Policy'],
                ['title' => 'Advance-to-Deposit Ratio (ADR) tax continues to challenge high-lending banks', 'sentiment' => 'bearish', 'source' => 'Tax Authority Circular'],
            ],
        ],
        'EFERT' => [
            'name' => 'Engro Fertilizers Limited',
            'sector' => 'Fertilizer',
            'current_price' => 135.0,
            'pe_ratio' => 5.8,
            'roe' => 41.2,
            'div_yield' => 14.8,
            'debt_equity' => 28.0,
            'pb_ratio' => 2.5,
            'eps' => 23.2,
            'volume_avg' => 1100000,
            'description' => 'Engro Fertilizers is a major player in the agricultural sector, manufacturing urea, DAP, and specialized fertilizer blends. Beneficiary of modernized plants (EnVen) with highly efficient fuel-gas consumption rates.',
            'recent_news' => [
                ['title' => 'Engro Fertilizers launches new eco-friendly fertilizer variants', 'sentiment' => 'bullish', 'source' => 'Product Launch'],
                ['title' => 'Interim payout outperforms consensus analyst forecasts', 'sentiment' => 'bullish', 'source' => 'Brokerage Note'],
                ['title' => 'Fittings upgrade shutdown at main plant completed successfully ahead of time', 'sentiment' => 'bullish', 'source' => 'Operations Update'],
            ],
        ],
        'PSO' => [
            'name' => 'Pakistan State Oil Company Limited',
            'sector' => 'Oil & Gas Marketing',
            'current_price' => 178.0,
            'pe_ratio' => 5.2,
            'roe' => 14.2,
            'div_yield' => 5.6,
            'debt_equity' => 68.0,
            'pb_ratio' => 0.5,
            'eps' => 34.2,
            'volume_avg' => 750000,
            'description' => 'PSO is the state-owned oil marketing giant, holding the largest market share in retail fuels and lubricants. Highly sensitive to circular debt challenges, but owns massive infrastructure assets.',
            'recent_news' => [
                ['title' => 'PSO circular debt resolution package under discussion at IMF review talks', 'sentiment' => 'bullish', 'source' => 'Finance Division Update'],
                ['title' => 'Petroleum product sales volume increases by 8% month-on-month', 'sentiment' => 'bullish', 'source' => 'Industry Statistics'],
                ['title' => 'Volatile exchange rate impacts inventory gains/losses for oil marketers', 'sentiment' => 'bearish', 'source' => 'Analytical report'],
            ],
        ],
        'DGKC' => [
            'name' => 'D.G. Khan Cement Company Limited',
            'sector' => 'Cement',
            'current_price' => 72.5,
            'pe_ratio' => 12.4,
            'roe' => 5.2,
            'div_yield' => 2.1,
            'debt_equity' => 58.0,
            'pb_ratio' => 0.4,
            'eps' => 5.8,
            'volume_avg' => 1800000,
            'description' => 'DGKC is a leading cement manufacturer with modern plants, including a waste-heat recovery system. Highly leveraged, making it vulnerable to high interest rates, and facing slow domestic construction activity.',
            'recent_news' => [
                ['title' => 'DGKC exports cement shipments to USA market, boosting foreign exchange', 'sentiment' => 'bullish', 'source' => 'Export Desk'],
                ['title' => 'High interest rates increase finance costs, compressing net margins', 'sentiment' => 'bearish', 'source' => 'Financial Statement'],
                ['title' => 'Domestic cement dispatch numbers fall by 5% year-on-year', 'sentiment' => 'bearish', 'source' => 'APCMA Data'],
            ],
        ],
        'HBL' => [
            'name' => 'Habib Bank Limited',
            'sector' => 'Commercial Banks',
            'current_price' => 115.0,
            'pe_ratio' => 4.8,
            'roe' => 19.8,
            'div_yield' => 8.7,
            'debt_equity' => 0.0,
            'pb_ratio' => 0.7,
            'eps' => 24.0,
            'volume_avg' => 1300000,
            'description' => "HBL is the largest commercial bank in Pakistan by asset size. It has a massive branch network and represents a major pillar of Pakistan's banking infrastructure, but has experienced higher provision expenses and capital adequacy challenges in international branches.",
            'recent_news' => [
                ['title' => 'HBL digital banking transactions reach landmark volume milestone', 'sentiment' => 'bullish', 'source' => 'PR News'],
                ['title' => 'State Bank audit highlights need for increased provisioning on specific loan books', 'sentiment' => 'bearish', 'source' => 'SBP Report'],
                ['title' => 'Bank focuses on agricultural lending programs to boost domestic economic growth', 'sentiment' => 'neutral', 'source' => 'Dawn News'],
            ],
        ],
        'MEBL' => [
            'name' => 'Meezan Bank Limited',
            'sector' => 'Commercial Banks',
            'current_price' => 220.0,
            'pe_ratio' => 6.2,
            'roe' => 48.2,
            'div_yield' => 7.4,
            'debt_equity' => 0.0,
            'pb_ratio' => 2.1,
            'eps' => 35.5,
            'volume_avg' => 1500000,
            'description' => 'Meezan Bank is the first and largest Islamic commercial bank in Pakistan. It is a pioneer in Shariah-compliant retail and corporate banking, demonstrating exceptional growth and high returns on equity.',
            'recent_news' => [
                ['title' => 'Meezan Bank profits surge by 45% on strong financing book growth', 'sentiment' => 'bullish', 'source' => 'Financial Statement'],
                ['title' => "State Bank of Pakistan commends Meezan Bank's financial inclusion strides", 'sentiment' => 'bullish', 'source' => 'SBP Review'],
                ['title' => 'Islamic banking asset share grows to historic highs in Pakistan', 'sentiment' => 'bullish', 'source' => 'Industry Update'],
            ],
        ],
        'HUBC' => [
            'name' => 'The Hub Power Company Limited',
            'sector' => 'Power Generation',
            'current_price' => 120.0,
            'pe_ratio' => 4.8,
            'roe' => 32.1,
            'div_yield' => 14.5,
            'debt_equity' => 42.0,
            'pb_ratio' => 1.5,
            'eps' => 25.0,
            'volume_avg' => 2500000,
            'description' => 'Hubco is the largest independent power producer (IPP) in Pakistan, with a combined power generation capacity of over 3,000 MW. It has diversified holdings in coal mines, telecom infrastructure, and water desalination.',
            'recent_news' => [
                ['title' => 'Hubco announces joint venture for regional electric vehicle assembly', 'sentiment' => 'bullish', 'source' => 'Corporate Disclosure'],
                ['title' => 'IPP circular debt receivables increase, posing minor working capital challenges', 'sentiment' => 'bearish', 'source' => 'Energy Analyst Report'],
                ['title' => 'Hubco declares interim dividend of Rs. 5 per share', 'sentiment' => 'bullish', 'source' => 'PSX Filing'],
            ],
        ],
        'OGDC' => [
            'name' => 'Oil & Gas Development Company Limited',
            'sector' => 'Oil & Gas Exploration',
            'current_price' => 140.0,
            'pe_ratio' => 3.8,
            'roe' => 22.4,
            'div_yield' => 8.2,
            'debt_equity' => 8.0,
            'pb_ratio' => 0.6,
            'eps' => 36.8,
            'volume_avg' => 2200000,
            'description' => 'OGDCL is the national oil and gas exploration company of Pakistan, holding the largest portfolio of hydrocarbon reserves and acreage. Strong state backing but exposed to circular debt receivables from utility buyers.',
            'recent_news' => [
                ['title' => 'OGDCL begins production at newly discovered oil well in Kohlu', 'sentiment' => 'bullish', 'source' => 'Operational Update'],
                ['title' => 'Government works on major plan to settle gas sector circular debt, positive for OGDCL receivables', 'sentiment' => 'bullish', 'source' => 'Ministry of Finance'],
                ['title' => 'International crude price fluctuations impact inventory margins', 'sentiment' => 'neutral', 'source' => 'Bloomberg'],
            ],
        ],
    ];

    return $profiles;
}

function get_available_stocks(): array
{
    $out = [];
    foreach (stock_profiles() as $symbol => $info) {
        $out[] = ['ticker' => $symbol, 'name' => $info['name'], 'sector' => $info['sector']];
    }
    return $out;
}

function get_pk_symbol_index(): array
{
    return get_available_stocks();
}

function get_stock_profile(string $ticker): ?array
{
    $ticker = strtoupper($ticker);
    $profiles = stock_profiles();
    return $profiles[$ticker] ?? null;
}
