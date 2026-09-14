<?php
/**
 * Loads data/markets.json (copied verbatim from backend/markets.json) and
 * exposes the hardcoded per-market global equity search indices ported
 * from main.py (US_STOCK_INDEX, IN_STOCK_INDEX, ...).
 */

declare(strict_types=1);

function markets_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }
    $path = __DIR__ . '/../data/markets.json';
    $config = [];
    if (is_file($path)) {
        $raw = file_get_contents($path);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $config = $decoded;
        }
    }
    return $config;
}

function global_stock_indices(): array
{
    return [
        'US' => [
            ['ticker' => 'AAPL', 'name' => 'Apple Inc.', 'sector' => 'Technology'],
            ['ticker' => 'MSFT', 'name' => 'Microsoft Corporation', 'sector' => 'Technology'],
            ['ticker' => 'TSLA', 'name' => 'Tesla, Inc.', 'sector' => 'Automotive'],
            ['ticker' => 'NVDA', 'name' => 'NVIDIA Corporation', 'sector' => 'Semiconductors'],
            ['ticker' => 'AMZN', 'name' => 'Amazon.com, Inc.', 'sector' => 'E-Commerce'],
            ['ticker' => 'GOOG', 'name' => 'Alphabet Inc.', 'sector' => 'Technology'],
            ['ticker' => 'META', 'name' => 'Meta Platforms, Inc.', 'sector' => 'Technology'],
            ['ticker' => 'NFLX', 'name' => 'Netflix, Inc.', 'sector' => 'Entertainment'],
            ['ticker' => 'AMD', 'name' => 'Advanced Micro Devices, Inc.', 'sector' => 'Semiconductors'],
            ['ticker' => 'INTC', 'name' => 'Intel Corporation', 'sector' => 'Semiconductors'],
            ['ticker' => 'QCOM', 'name' => 'Qualcomm Incorporated', 'sector' => 'Semiconductors'],
            ['ticker' => 'AVGO', 'name' => 'Broadcom Inc.', 'sector' => 'Semiconductors'],
            ['ticker' => 'BABA', 'name' => 'Alibaba Group Holding Limited', 'sector' => 'E-Commerce'],
            ['ticker' => 'PYPL', 'name' => 'PayPal Holdings, Inc.', 'sector' => 'Financial Technology'],
            ['ticker' => 'V', 'name' => 'Visa Inc.', 'sector' => 'Financial Services'],
            ['ticker' => 'MA', 'name' => 'Mastercard Incorporated', 'sector' => 'Financial Services'],
            ['ticker' => 'JPM', 'name' => 'JPMorgan Chase & Co.', 'sector' => 'Financial Services'],
            ['ticker' => 'BAC', 'name' => 'Bank of America Corporation', 'sector' => 'Financial Services'],
            ['ticker' => 'DIS', 'name' => 'The Walt Disney Company', 'sector' => 'Entertainment'],
            ['ticker' => 'NKE', 'name' => 'NIKE, Inc.', 'sector' => 'Apparel & Accessories'],
            ['ticker' => 'SBUX', 'name' => 'Starbucks Corporation', 'sector' => 'Consumer Services'],
            ['ticker' => 'KO', 'name' => 'The Coca-Cola Company', 'sector' => 'Beverages'],
            ['ticker' => 'PEP', 'name' => 'PepsiCo, Inc.', 'sector' => 'Beverages & Snacks'],
            ['ticker' => 'WMT', 'name' => 'Walmart Inc.', 'sector' => 'Retail'],
            ['ticker' => 'COST', 'name' => 'Costco Wholesale Corporation', 'sector' => 'Retail'],
        ],
        'IN' => [
            ['ticker' => 'RELIANCE.NS', 'name' => 'Reliance Industries Limited', 'sector' => 'Energy'],
            ['ticker' => 'TCS.NS', 'name' => 'Tata Consultancy Services Limited', 'sector' => 'Technology'],
            ['ticker' => 'HDFCBANK.NS', 'name' => 'HDFC Bank Limited', 'sector' => 'Financial Services'],
            ['ticker' => 'INFY.NS', 'name' => 'Infosys Limited', 'sector' => 'Technology'],
            ['ticker' => 'ICICIBANK.NS', 'name' => 'ICICI Bank Limited', 'sector' => 'Financial Services'],
            ['ticker' => 'HINDUNILVR.NS', 'name' => 'Hindustan Unilever Limited', 'sector' => 'Consumer Defensive'],
            ['ticker' => 'ITC.NS', 'name' => 'ITC Limited', 'sector' => 'Consumer Defensive'],
            ['ticker' => 'SBIN.NS', 'name' => 'State Bank of India', 'sector' => 'Financial Services'],
            ['ticker' => 'BHARTIARTL.NS', 'name' => 'Bharti Airtel Limited', 'sector' => 'Telecommunications'],
            ['ticker' => 'LTIM.NS', 'name' => 'LTIMindtree Limited', 'sector' => 'Technology'],
        ],
        'UK' => [
            ['ticker' => 'BP.L', 'name' => 'BP p.l.c.', 'sector' => 'Energy'],
            ['ticker' => 'HSBA.L', 'name' => 'HSBC Holdings plc', 'sector' => 'Financial Services'],
            ['ticker' => 'GSK.L', 'name' => 'GSK plc', 'sector' => 'Healthcare'],
            ['ticker' => 'AZN.L', 'name' => 'AstraZeneca plc', 'sector' => 'Healthcare'],
            ['ticker' => 'VOD.L', 'name' => 'Vodafone Group Public Limited Company', 'sector' => 'Telecommunications'],
            ['ticker' => 'SHEL.L', 'name' => 'Shell plc', 'sector' => 'Energy'],
            ['ticker' => 'BARC.L', 'name' => 'Barclays PLC', 'sector' => 'Financial Services'],
            ['ticker' => 'LLOY.L', 'name' => 'Lloyds Banking Group plc', 'sector' => 'Financial Services'],
            ['ticker' => 'ULVR.L', 'name' => 'Unilever PLC', 'sector' => 'Consumer Defensive'],
            ['ticker' => 'RIO.L', 'name' => 'Rio Tinto Group', 'sector' => 'Basic Materials'],
        ],
        'CA' => [
            ['ticker' => 'RY.TO', 'name' => 'Royal Bank of Canada', 'sector' => 'Financial Services'],
            ['ticker' => 'TD.TO', 'name' => 'The Toronto-Dominion Bank', 'sector' => 'Financial Services'],
            ['ticker' => 'SHOP.TO', 'name' => 'Shopify Inc.', 'sector' => 'Technology'],
            ['ticker' => 'ENB.TO', 'name' => 'Enbridge Inc.', 'sector' => 'Energy'],
            ['ticker' => 'BNS.TO', 'name' => 'The Bank of Nova Scotia', 'sector' => 'Financial Services'],
            ['ticker' => 'CNR.TO', 'name' => 'Canadian National Railway Company', 'sector' => 'Industrials'],
        ],
        'JP' => [
            ['ticker' => '7203.T', 'name' => 'Toyota Motor Corporation', 'sector' => 'Automotive'],
            ['ticker' => '6758.T', 'name' => 'Sony Group Corporation', 'sector' => 'Consumer Electronics'],
            ['ticker' => '9984.T', 'name' => 'SoftBank Group Corp.', 'sector' => 'Telecommunications'],
            ['ticker' => '8035.T', 'name' => 'Tokyo Electron Limited', 'sector' => 'Semiconductors'],
            ['ticker' => '6861.T', 'name' => 'Keyence Corporation', 'sector' => 'Electronics'],
        ],
        'DE' => [
            ['ticker' => 'SAP.DE', 'name' => 'SAP SE', 'sector' => 'Technology'],
            ['ticker' => 'SIE.DE', 'name' => 'Siemens Aktiengesellschaft', 'sector' => 'Conglomerates'],
            ['ticker' => 'ALV.DE', 'name' => 'Allianz SE', 'sector' => 'Financial Services'],
            ['ticker' => 'VOW3.DE', 'name' => 'Volkswagen AG', 'sector' => 'Automotive'],
            ['ticker' => 'MBG.DE', 'name' => 'Mercedes-Benz Group AG', 'sector' => 'Automotive'],
            ['ticker' => 'BAS.DE', 'name' => 'BASF SE', 'sector' => 'Chemicals'],
        ],
        'AU' => [
            ['ticker' => 'BHP.AX', 'name' => 'BHP Group Limited', 'sector' => 'Basic Materials'],
            ['ticker' => 'CBA.AX', 'name' => 'Commonwealth Bank of Australia', 'sector' => 'Financial Services'],
            ['ticker' => 'RIO.AX', 'name' => 'Rio Tinto Limited', 'sector' => 'Basic Materials'],
            ['ticker' => 'TLS.AX', 'name' => 'Telstra Group Limited', 'sector' => 'Telecommunications'],
            ['ticker' => 'CSL.AX', 'name' => 'CSL Limited', 'sector' => 'Healthcare'],
        ],
        'SA' => [
            ['ticker' => '2222.SR', 'name' => 'Saudi Arabian Oil Company', 'sector' => 'Energy'],
            ['ticker' => '1120.SR', 'name' => 'Al Rajhi Banking & Investment Corp.', 'sector' => 'Financial Services'],
            ['ticker' => '1150.SR', 'name' => 'Alinma Bank', 'sector' => 'Financial Services'],
            ['ticker' => '2010.SR', 'name' => 'Saudi Basic Industries Corporation', 'sector' => 'Chemicals'],
            ['ticker' => '7010.SR', 'name' => 'Saudi Telecom Company', 'sector' => 'Telecommunications'],
        ],
        'AE' => [
            ['ticker' => 'EMAAR.DU', 'name' => 'Emaar Properties PJSC', 'sector' => 'Real Estate'],
            ['ticker' => 'DEWA.DU', 'name' => 'Dubai Electricity & Water Authority', 'sector' => 'Utilities'],
            ['ticker' => 'DFM.DU', 'name' => 'Dubai Financial Market PJSC', 'sector' => 'Financial Services'],
            ['ticker' => 'TAQA.AD', 'name' => 'Abu Dhabi National Energy Company', 'sector' => 'Utilities'],
            ['ticker' => 'FAB.AD', 'name' => 'First Abu Dhabi Bank PJSC', 'sector' => 'Financial Services'],
        ],
        'CN' => [
            ['ticker' => '601398.SS', 'name' => 'Industrial and Commercial Bank of China Limited', 'sector' => 'Financial Services'],
            ['ticker' => '600519.SS', 'name' => 'Kweichow Moutai Co., Ltd.', 'sector' => 'Beverages'],
            ['ticker' => '601857.SS', 'name' => 'PetroChina Company Limited', 'sector' => 'Energy'],
            ['ticker' => '600028.SS', 'name' => 'China Petroleum & Chemical Corporation', 'sector' => 'Energy'],
            ['ticker' => '601988.SS', 'name' => 'Bank of China Limited', 'sector' => 'Financial Services'],
        ],
        'QA' => [
            ['ticker' => 'QNBK.QA', 'name' => 'Qatar National Bank (Q.P.S.C.)', 'sector' => 'Financial Services'],
            ['ticker' => 'QGTS.QA', 'name' => 'Qatar Gas Transport Company Limited (Nakilat)', 'sector' => 'Industrials'],
            ['ticker' => 'IQCD.QA', 'name' => 'Industries Qatar Q.P.S.C.', 'sector' => 'Basic Materials'],
            ['ticker' => 'QEWS.QA', 'name' => 'Qatar Electricity & Water Company Q.P.S.C.', 'sector' => 'Utilities'],
            ['ticker' => 'QIBK.QA', 'name' => 'Qatar Islamic Bank (Q.P.S.C.)', 'sector' => 'Financial Services'],
        ],
        'EG' => [
            ['ticker' => 'COMI.CA', 'name' => 'Commercial International Bank (Egypt) S.A.E.', 'sector' => 'Financial Services'],
            ['ticker' => 'EAST.CA', 'name' => 'Eastern Company S.A.E.', 'sector' => 'Consumer Defensive'],
            ['ticker' => 'SWDY.CA', 'name' => 'Elsewedy Electric Co.', 'sector' => 'Industrials'],
            ['ticker' => 'FWRY.CA', 'name' => 'Fawry for Banking Technology and Electronic Payments S.A.E.', 'sector' => 'Financial Technology'],
            ['ticker' => 'ETEL.CA', 'name' => 'Telecom Egypt Company S.A.E.', 'sector' => 'Telecommunications'],
        ],
        'IR' => [
            ['ticker' => 'IRR=X', 'name' => 'Iranian Rial Proxy Spot Exchange Rate', 'sector' => 'Foreign Exchange'],
            ['ticker' => 'GC=F', 'name' => 'Gold Spot Proxy Rate', 'sector' => 'Precious Metals'],
            ['ticker' => 'SI=F', 'name' => 'Silver Spot Proxy Rate', 'sector' => 'Precious Metals'],
        ],
        'TR' => [
            ['ticker' => 'THYAO.IS', 'name' => 'Turk Hava Yollari Anonim Ortakligi', 'sector' => 'Airlines'],
            ['ticker' => 'ASELS.IS', 'name' => 'Aselsan Elektronik Sanayi ve Ticaret A.S.', 'sector' => 'Defense & Aerospace'],
            ['ticker' => 'AKBNK.IS', 'name' => 'Akbank T.A.S.', 'sector' => 'Financial Services'],
            ['ticker' => 'EREGL.IS', 'name' => 'Eregli Demir ve Celik Fabrikalari T.A.S.', 'sector' => 'Basic Materials'],
            ['ticker' => 'TUPRS.IS', 'name' => 'Turkiye Petrol Rafinerileri A.S.', 'sector' => 'Energy'],
        ],
    ];
}

function market_ticker_suffixes(): array
{
    return [
        'US' => '', 'IN' => '.NS', 'UK' => '.L', 'CA' => '.TO', 'JP' => '.T',
        'DE' => '.DE', 'AU' => '.AX', 'SA' => '.SR', 'AE' => '.DU', 'CN' => '.SS',
        'QA' => '.QA', 'EG' => '.CA', 'IR' => '=X', 'TR' => '.IS',
    ];
}

function macro_index_names_map(): array
{
    return [
        '^KSE' => 'KSE100', '^GSPC' => 'S&P 500', '^NSEI' => 'NIFTY 50', '^FTSE' => 'FTSE 100',
        '^GSPTSE' => 'S&P/TSX', '^N225' => 'Nikkei 225', '^GDAXI' => 'DAX', '^AXJO' => 'S&P/ASX 200',
        '^TASI.SR' => 'Tadawul', '^DFMGI' => 'DFMGI', '000001.SS' => 'SSE Composite',
        '^QE' => 'QE General', '^EGX30' => 'EGX 30', 'IRR=X' => 'USD/IRR', 'XU100.IS' => 'BIST 100',
    ];
}
