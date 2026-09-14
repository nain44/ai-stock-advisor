<?php
/**
 * Ported from backend/technical_analysis.py. Pure numeric indicator math,
 * operating on the list-of-associative-arrays OHLCV shape produced by
 * data_fetcher.php's generate_historical_data() (each row has
 * Date/Open/High/Low/Close/Volume, in chronological order).
 */

declare(strict_types=1);

/** Simple moving average of $column over $period, aligned to $rows (null before enough data). */
function calc_sma(array $rows, int $period, string $column = 'Close'): array
{
    $n = count($rows);
    $out = array_fill(0, $n, null);
    for ($i = 0; $i < $n; $i++) {
        if ($i + 1 < $period) {
            continue;
        }
        $sum = 0.0;
        for ($j = $i - $period + 1; $j <= $i; $j++) {
            $sum += (float)$rows[$j][$column];
        }
        $out[$i] = $sum / $period;
    }
    return $out;
}

/** Exponential moving average (span=$period, adjust=False, matching pandas .ewm(span=,adjust=False)). */
function calc_ema(array $rows, int $period, string $column = 'Close'): array
{
    $n = count($rows);
    $out = array_fill(0, $n, null);
    if ($n === 0) {
        return $out;
    }
    $alpha = 2.0 / ($period + 1);
    $prev = (float)$rows[0][$column];
    $out[0] = $prev;
    for ($i = 1; $i < $n; $i++) {
        $val = (float)$rows[$i][$column];
        $prev = $alpha * $val + (1 - $alpha) * $prev;
        $out[$i] = $prev;
    }
    return $out;
}

/** Relative Strength Index over $period, using a simple rolling mean of gains/losses. */
function calc_rsi(array $rows, int $period = 14, string $column = 'Close'): array
{
    $n = count($rows);
    $out = array_fill(0, $n, 50.0);
    if ($n < 2) {
        return $out;
    }

    $deltas = array_fill(0, $n, 0.0);
    for ($i = 1; $i < $n; $i++) {
        $deltas[$i] = (float)$rows[$i][$column] - (float)$rows[$i - 1][$column];
    }

    for ($i = 0; $i < $n; $i++) {
        if ($i + 1 < $period) {
            continue;
        }
        $gainSum = 0.0;
        $lossSum = 0.0;
        for ($j = $i - $period + 1; $j <= $i; $j++) {
            $d = $deltas[$j];
            if ($d > 0) {
                $gainSum += $d;
            } elseif ($d < 0) {
                $lossSum += -$d;
            }
        }
        $gain = $gainSum / $period;
        $loss = $lossSum / $period;
        $rs = $gain / ($loss + 1e-10);
        $out[$i] = 100 - (100 / (1 + $rs));
    }
    return $out;
}

/** MACD line / signal line / histogram. Returns [macdLine, signalLine, macdHist] arrays. */
function calc_macd(array $rows, int $fastPeriod = 12, int $slowPeriod = 26, int $signalPeriod = 9, string $column = 'Close'): array
{
    $fastEma = calc_ema($rows, $fastPeriod, $column);
    $slowEma = calc_ema($rows, $slowPeriod, $column);
    $n = count($rows);

    $macdLine = array_fill(0, $n, null);
    for ($i = 0; $i < $n; $i++) {
        $macdLine[$i] = $fastEma[$i] - $slowEma[$i];
    }

    // Signal = EMA(span=signalPeriod, adjust=False) of macdLine
    $signalLine = array_fill(0, $n, null);
    if ($n > 0) {
        $alpha = 2.0 / ($signalPeriod + 1);
        $prev = $macdLine[0];
        $signalLine[0] = $prev;
        for ($i = 1; $i < $n; $i++) {
            $prev = $alpha * $macdLine[$i] + (1 - $alpha) * $prev;
            $signalLine[$i] = $prev;
        }
    }

    $macdHist = array_fill(0, $n, null);
    for ($i = 0; $i < $n; $i++) {
        $macdHist[$i] = $macdLine[$i] - $signalLine[$i];
    }

    return [$macdLine, $signalLine, $macdHist];
}

/** Bollinger Bands: [middle(SMA), upper, lower]. */
function calc_bollinger_bands(array $rows, int $period = 20, float $numStd = 2.0, string $column = 'Close'): array
{
    $sma = calc_sma($rows, $period, $column);
    $n = count($rows);
    $upper = array_fill(0, $n, null);
    $lower = array_fill(0, $n, null);

    for ($i = 0; $i < $n; $i++) {
        if ($sma[$i] === null) {
            continue;
        }
        $sum = 0.0;
        for ($j = $i - $period + 1; $j <= $i; $j++) {
            $sum += ((float)$rows[$j][$column] - $sma[$i]) ** 2;
        }
        // pandas' rolling std defaults to ddof=1 (sample std)
        $std = $period > 1 ? sqrt($sum / ($period - 1)) : 0.0;
        $upper[$i] = $sma[$i] + ($numStd * $std);
        $lower[$i] = $sma[$i] - ($numStd * $std);
    }

    return [$sma, $upper, $lower];
}

function analyze_volume(array $rows, int $period = 20): array
{
    $n = count($rows);
    if ($n === 0) {
        return ['avg_volume' => 0.0, 'ratio' => 1.0, 'status' => 'Neutral'];
    }
    if ($n < $period) {
        $sum = 0.0;
        foreach ($rows as $r) {
            $sum += (float)$r['Volume'];
        }
        return ['avg_volume' => $sum / $n, 'ratio' => 1.0, 'status' => 'Neutral'];
    }

    $latestVolume = (float)$rows[$n - 1]['Volume'];
    $sum = 0.0;
    for ($j = $n - $period; $j < $n; $j++) {
        $sum += (float)$rows[$j]['Volume'];
    }
    $avgVolume = $sum / $period;
    $ratio = $latestVolume / ($avgVolume + 1e-10);

    if ($ratio > 1.5) {
        $status = 'High Volume (Bullish on green day, Bearish on red day)';
    } elseif ($ratio < 0.5) {
        $status = 'Decreasing Volume';
    } else {
        $status = 'Normal Volume';
    }

    return [
        'latest_volume' => $latestVolume,
        'avg_volume' => $avgVolume,
        'ratio' => round($ratio, 2),
        'status' => $status,
    ];
}

/**
 * Runs all technical indicators and compiles their latest values into a
 * structured array, mirroring run_full_technical_analysis() in
 * technical_analysis.py.
 */
function run_full_technical_analysis(array $rows): array
{
    $n = count($rows);
    if ($n === 0) {
        throw new InvalidArgumentException('No historical data to analyze.');
    }

    $sma50 = calc_sma($rows, 50);
    $sma200 = calc_sma($rows, 200);
    $rsi = calc_rsi($rows, 14);
    [$macdLine, $macdSignal, $macdHist] = calc_macd($rows);
    [$bbMid, $bbUpper, $bbLower] = calc_bollinger_bands($rows);

    $lastIdx = $n - 1;
    $prevIdx = $n > 1 ? $n - 2 : $n - 1;

    $volAnalysis = analyze_volume($rows);

    $rsiVal = (float)$rsi[$lastIdx];
    $prevRsi = (float)$rsi[$prevIdx];
    $rsiStatus = 'Neutral';
    if ($rsiVal > 70) {
        $rsiStatus = 'Overbought (Bearish potential)';
    } elseif ($rsiVal < 30) {
        $rsiStatus = 'Oversold (Bullish potential)';
    } elseif ($rsiVal > $prevRsi && $prevRsi < 40) {
        $rsiStatus = 'Recovering (Bullish)';
    }

    $macdVal = (float)$macdLine[$lastIdx];
    $macdSig = (float)$macdSignal[$lastIdx];
    $prevMacdVal = (float)$macdLine[$prevIdx];
    $prevMacdSig = (float)$macdSignal[$prevIdx];

    $macdCrossover = 'Neutral';
    if ($prevMacdVal < $prevMacdSig && $macdVal > $macdSig) {
        $macdCrossover = 'Bullish Crossover';
    } elseif ($prevMacdVal > $prevMacdSig && $macdVal < $macdSig) {
        $macdCrossover = 'Bearish Crossover';
    }

    $closePrice = (float)$rows[$lastIdx]['Close'];
    $sma50Val = $sma50[$lastIdx] !== null ? (float)$sma50[$lastIdx] : $closePrice;
    $sma200Val = $sma200[$lastIdx] !== null ? (float)$sma200[$lastIdx] : $closePrice;

    $sma50Status = $closePrice > $sma50Val ? 'Above' : 'Below';
    $sma200Status = $closePrice > $sma200Val ? 'Above' : 'Below';

    $bbUpperVal = $bbUpper[$lastIdx] !== null ? (float)$bbUpper[$lastIdx] : $closePrice;
    $bbLowerVal = $bbLower[$lastIdx] !== null ? (float)$bbLower[$lastIdx] : $closePrice;

    $bbStatus = 'Neutral';
    if ($closePrice > $bbUpperVal) {
        $bbStatus = 'Above Upper Band (Overextended/Overbought)';
    } elseif ($closePrice < $bbLowerVal) {
        $bbStatus = 'Below Lower Band (Oversold)';
    }

    return [
        'current_price' => round($closePrice, 2),
        'rsi' => [
            'value' => round($rsiVal, 2),
            'status' => $rsiStatus,
        ],
        'macd' => [
            'line' => round($macdVal, 4),
            'signal' => round($macdSig, 4),
            'histogram' => round((float)$macdHist[$lastIdx], 4),
            'crossover' => $macdCrossover,
        ],
        'moving_averages' => [
            'sma_50' => round($sma50Val, 2),
            'sma_50_status' => $sma50Status,
            'sma_200' => round($sma200Val, 2),
            'sma_200_status' => $sma200Status,
        ],
        'bollinger_bands' => [
            'upper' => round($bbUpperVal, 2),
            'middle' => $bbMid[$lastIdx] !== null ? round((float)$bbMid[$lastIdx], 2) : $closePrice,
            'lower' => round($bbLowerVal, 2),
            'status' => $bbStatus,
        ],
        'volume' => $volAnalysis,
    ];
}
