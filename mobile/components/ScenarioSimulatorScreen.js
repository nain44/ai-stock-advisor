import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calculator, Activity, Briefcase, CirclePlus } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { AppNativeAd } from './AdManager';
import PortfolioScreen from './PortfolioScreen';

const getCurrencySymbol = (m) => {
  if (m === 'US') return '$';
  if (m === 'IN') return '₹';
  if (m === 'UK') return '£';
  return 'Rs.';
};

const toNum = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const formatMoney = (n) => {
  if (!isFinite(n)) return '0';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// First calculation is free; every run after that shows an interstitial
// before revealing the (updated) result — unless the user has watched a
// rewarded ad to skip that gate for the rest of the session. Same gating
// pattern used by the other calculators in this app.
function useGatedCalculate(triggerInterstitial, skipGateUnlocked) {
  const [hasCalculatedOnce, setHasCalculatedOnce] = useState(false);
  const requestCalculate = (computeFn) => {
    if (!hasCalculatedOnce) {
      setHasCalculatedOnce(true);
      computeFn();
    } else if (skipGateUnlocked || !triggerInterstitial) {
      computeFn();
    } else {
      triggerInterstitial(computeFn);
    }
  };
  return { requestCalculate, hasCalculatedOnce };
}

function SkipGateLink({ visible, triggerRewarded, onUnlocked }) {
  if (!visible) return null;
  return (
    <TouchableOpacity
      style={styles.skipGateLink}
      onPress={() => triggerRewarded && triggerRewarded(onUnlocked)}
      activeOpacity={0.7}
    >
      <Text style={styles.skipGateLinkText}>Watch an ad to skip ads for the rest of this session</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, theme, placeholder, keyboardType = 'numeric' }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.subtext }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: theme.bg === '#0B0F19' ? '#0F172A' : '#F1F5F9', color: theme.text, borderColor: theme.border }]}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function CalculateButton({ onPress, disabled, label = 'Calculate' }) {
  return (
    <TouchableOpacity
      style={[styles.calculateBtn, disabled && styles.calculateBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Calculator size={16} color="#0B0F19" style={{ marginRight: 6 }} />
      <Text style={styles.calculateBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// Drift per "day" for each trend, and per-day volatility (std dev of daily
// % change) for each volatility level. These are teaching-tool knobs, not
// calibrated to any real market's statistics.
const SCENARIO_TREND_DRIFT = { bullish: 0.0015, neutral: 0, bearish: -0.0015 };
const SCENARIO_VOLATILITY = { low: 0.008, medium: 0.018, high: 0.035 };

// Box-Muller transform: turns two uniform randoms into one standard-normal
// random, so daily price changes cluster near the mean instead of being
// flatly random — closer to how real returns actually distribute.
function randomNormal() {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1 || 1e-9)) * Math.cos(2 * Math.PI * u2);
}

function runScenario({ startingPrice, trend, volatility, days }) {
  const drift = SCENARIO_TREND_DRIFT[trend];
  const vol = SCENARIO_VOLATILITY[volatility];
  let price = startingPrice;
  let peak = price;
  let maxDrawdownPct = 0;
  const series = [price];
  for (let d = 1; d <= days; d++) {
    const change = drift + vol * randomNormal();
    price = Math.max(price * (1 + change), 0.01);
    series.push(price);
    peak = Math.max(peak, price);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - price) / peak) * 100);
  }
  const totalReturnPct = ((price - startingPrice) / startingPrice) * 100;
  return { series, finalPrice: price, totalReturnPct, maxDrawdownPct };
}

function scenarioTakeaway({ trend, volatility, totalReturnPct, maxDrawdownPct }) {
  const trendWord = trend === 'bullish' ? 'upward' : trend === 'bearish' ? 'downward' : 'flat';
  const volWord = volatility === 'high' ? 'very bumpy' : volatility === 'medium' ? 'moderately bumpy' : 'fairly smooth';
  const endedWord = totalReturnPct >= 0 ? 'gained' : 'lost';
  return `You chose a ${trendWord} trend with ${volWord} volatility. Along the way, the price dipped as much as ${maxDrawdownPct.toFixed(1)}% below its peak before the period ended, and it ${endedWord} ${Math.abs(totalReturnPct).toFixed(1)}% overall. That gap between the drawdown and the final result is the difference between a stock's long-term trend and its short-term volatility: a clear trend can still contain a rough ride, and a rough ride doesn't mean the trend changed.`;
}

export default function ScenarioSimulatorScreen({ market, apiUrl, config, portfolio, setPortfolio, triggerInterstitial, triggerRewarded, isDarkMode, seed, onSeedConsumed }) {
  const theme = {
    bg: isDarkMode ? '#0B0F19' : '#F8FAFC',
    card: isDarkMode ? '#161B26' : '#FFFFFF',
    border: isDarkMode ? '#222A3C' : '#E2E8F0',
    text: isDarkMode ? '#FFFFFF' : '#0F172A',
    subtext: isDarkMode ? '#94A3B8' : '#64748B',
  };

  const [screenTab, setScreenTab] = useState('simulator');
  const [skipGateUnlocked, setSkipGateUnlocked] = useState(false);
  const [startingPrice, setStartingPrice] = useState('100');
  const [trend, setTrend] = useState('bullish');
  const [volatility, setVolatility] = useState('medium');
  const [days, setDays] = useState('90');
  const [investment, setInvestment] = useState('100000');
  const [result, setResult] = useState(null);
  const [practicingLabel, setPracticingLabel] = useState(null);
  const [practicingTicker, setPracticingTicker] = useState(null);
  const [addedToPortfolio, setAddedToPortfolio] = useState(false);
  const { requestCalculate, hasCalculatedOnce } = useGatedCalculate(triggerInterstitial, skipGateUnlocked);

  // Consume the seed once: pre-fill the starting price from the dashboard
  // stock that was tapped, then clear it so it doesn't re-apply later.
  useEffect(() => {
    if (!seed) return;
    setScreenTab('simulator');
    setStartingPrice(String(Math.round((seed.startingPrice || 100) * 100) / 100));
    setPracticingLabel(seed.name || null);
    setPracticingTicker(seed.ticker || null);
    setResult(null);
    setAddedToPortfolio(false);
    onSeedConsumed && onSeedConsumed();
  }, [seed]);

  const currencySymbol = getCurrencySymbol(market);

  const handleRunScenario = () => {
    requestCalculate(() => {
      const clampedDays = Math.max(5, Math.min(365, Math.round(toNum(days)) || 90));
      const sim = runScenario({
        startingPrice: Math.max(toNum(startingPrice), 0.01),
        trend,
        volatility,
        days: clampedDays,
      });
      const investedAmount = toNum(investment);
      const finalValue = investedAmount * (1 + sim.totalReturnPct / 100);
      setResult({ ...sim, days: clampedDays, investedAmount, finalValue, startingPrice: Math.max(toNum(startingPrice), 0.01) });
      setAddedToPortfolio(false);
    });
  };

  // Records this scenario run as a paper holding — quantity is however many
  // "shares" the hypothetical investment would have bought at the starting
  // price, avgPrice is that starting price, currentPrice is the simulated
  // ending price. Ticker gets a "-SIM" suffix so it reads clearly as a
  // practice position next to any real holdings in the same list.
  const handleAddToPortfolio = () => {
    if (!result || !setPortfolio) return;
    const baseTicker = practicingTicker || 'SCENARIO';
    const simTicker = `${baseTicker}-SIM`;
    const quantity = Math.max(1, Math.round(result.investedAmount / result.startingPrice));

    const updated = [...portfolio];
    const existingIdx = updated.findIndex(h => h.ticker === simTicker && h.market === market);
    if (existingIdx >= 0) {
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity,
        avgPrice: result.startingPrice,
        currentPrice: result.finalPrice,
      };
    } else {
      updated.push({
        ticker: simTicker,
        quantity,
        avgPrice: result.startingPrice,
        currentPrice: result.finalPrice,
        market,
      });
    }
    setPortfolio(updated);
    setAddedToPortfolio(true);
  };

  const chartW = 300;
  const chartH = 120;
  const { linePath, areaPath } = result
    ? (() => {
        const prices = result.series;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const points = prices.map((price, idx) => ({
          x: (idx / (prices.length - 1)) * chartW,
          y: chartH - ((price - min) / range) * chartH,
        }));
        const line = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        return { linePath: line, areaPath: `${line} L ${chartW} ${chartH} L 0 ${chartH} Z` };
      })()
    : { linePath: '', areaPath: '' };

  const gainColor = result && result.totalReturnPct >= 0 ? '#34D399' : '#F87171';

  if (screenTab === 'portfolio') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.headerBlock}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Scenario Simulator</Text>
          <View style={styles.screenTabRow}>
            <TouchableOpacity
              style={[styles.screenTabChip, { borderColor: theme.border }]}
              onPress={() => setScreenTab('simulator')}
            >
              <Activity size={15} color={theme.subtext} style={{ marginRight: 6 }} />
              <Text style={[styles.screenTabText, { color: theme.subtext }]}>Simulator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.screenTabChip, styles.screenTabChipActive, { borderColor: theme.border }]}
              onPress={() => setScreenTab('portfolio')}
            >
              <Briefcase size={15} color="#00D2FF" style={{ marginRight: 6 }} />
              <Text style={[styles.screenTabText, { color: '#00D2FF' }]}>Portfolio</Text>
            </TouchableOpacity>
          </View>
        </View>
        <PortfolioScreen
          portfolio={portfolio}
          setPortfolio={setPortfolio}
          apiUrl={apiUrl}
          triggerInterstitial={triggerInterstitial}
          triggerRewarded={triggerRewarded}
          config={config}
          market={market}
          isDarkMode={isDarkMode}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>Scenario Simulator</Text>
        <View style={styles.screenTabRow}>
          <TouchableOpacity
            style={[styles.screenTabChip, styles.screenTabChipActive, { borderColor: theme.border }]}
            onPress={() => setScreenTab('simulator')}
          >
            <Activity size={15} color="#00D2FF" style={{ marginRight: 6 }} />
            <Text style={[styles.screenTabText, { color: '#00D2FF' }]}>Simulator</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.screenTabChip, { borderColor: theme.border }]}
            onPress={() => setScreenTab('portfolio')}
          >
            <Briefcase size={15} color={theme.subtext} style={{ marginRight: 6 }} />
            <Text style={[styles.screenTabText, { color: theme.subtext }]}>Portfolio</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Activity size={16} color="#00D2FF" style={{ marginRight: 6 }} />
            <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Set up your scenario</Text>
          </View>
          <Text style={[styles.helperText, { marginTop: -8, marginBottom: 12 }]}>
            {practicingLabel
              ? `Practicing with ${practicingLabel}'s current price as a starting point — everything from here is still a hypothetical, editable simulation.`
              : 'Fully synthetic — a teaching tool, not a market forecast.'}
          </Text>

          <Field label={`Starting Price (${currencySymbol})`} value={startingPrice} onChangeText={setStartingPrice} theme={theme} placeholder="100" />

          <Text style={[styles.fieldLabel, { color: theme.subtext }]}>Trend</Text>
          <View style={styles.standardRow}>
            {['bearish', 'neutral', 'bullish'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.standardBtn, { borderColor: theme.border }, trend === t && styles.standardBtnActive]}
                onPress={() => setTrend(t)}
              >
                <Text style={[styles.standardBtnText, { color: trend === t ? '#00D2FF' : theme.subtext, textTransform: 'capitalize' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.subtext }]}>Volatility</Text>
          <View style={styles.standardRow}>
            {['low', 'medium', 'high'].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.standardBtn, { borderColor: theme.border }, volatility === v && styles.standardBtnActive]}
                onPress={() => setVolatility(v)}
              >
                <Text style={[styles.standardBtnText, { color: volatility === v ? '#00D2FF' : theme.subtext, textTransform: 'capitalize' }]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Time Period (days)" value={days} onChangeText={setDays} theme={theme} placeholder="90" />
          <Field label={`Hypothetical Investment (${currencySymbol})`} value={investment} onChangeText={setInvestment} theme={theme} placeholder="100000" />
        </View>

        <CalculateButton onPress={handleRunScenario} label={result ? 'Run Again' : 'Run Simulation'} />
        <SkipGateLink
          visible={hasCalculatedOnce && !skipGateUnlocked}
          triggerRewarded={triggerRewarded}
          onUnlocked={() => setSkipGateUnlocked(true)}
        />

        {result && (
          <>
            <View style={[styles.resultCard, { backgroundColor: 'rgba(0, 210, 255, 0.08)', borderColor: '#00D2FF' }]}>
              <Text style={[styles.resultLabel, { color: theme.subtext }]}>Total Return over {result.days} days</Text>
              <Text style={[styles.resultValue, { color: gainColor }]}>
                {result.totalReturnPct >= 0 ? '+' : ''}{result.totalReturnPct.toFixed(2)}%
              </Text>

              <View style={{ marginVertical: 12 }}>
                <Svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                  <Path d={areaPath} fill="rgba(0, 210, 255, 0.12)" />
                  <Path d={linePath} fill="none" stroke={gainColor} strokeWidth="2.5" />
                </Svg>
              </View>

              <View style={styles.growthStatsRow}>
                <View>
                  <Text style={styles.helperText}>Final Price</Text>
                  <Text style={[styles.growthStatVal, { color: theme.text }]}>{currencySymbol} {formatMoney(result.finalPrice)}</Text>
                </View>
                <View>
                  <Text style={styles.helperText}>Max Drawdown</Text>
                  <Text style={[styles.growthStatVal, { color: '#F87171' }]}>-{result.maxDrawdownPct.toFixed(1)}%</Text>
                </View>
                <View>
                  <Text style={styles.helperText}>Investment Would Be</Text>
                  <Text style={[styles.growthStatVal, { color: theme.text }]}>{currencySymbol} {formatMoney(result.finalValue)}</Text>
                </View>
              </View>

              {setPortfolio && (
                <TouchableOpacity
                  style={[styles.addToPortfolioBtn, addedToPortfolio && styles.addToPortfolioBtnDone]}
                  onPress={handleAddToPortfolio}
                  disabled={addedToPortfolio}
                  activeOpacity={0.8}
                >
                  <CirclePlus size={15} color={addedToPortfolio ? '#34D399' : '#00D2FF'} style={{ marginRight: 6 }} />
                  <Text style={[styles.addToPortfolioBtnText, { color: addedToPortfolio ? '#34D399' : '#00D2FF' }]}>
                    {addedToPortfolio ? 'Added as a paper holding' : 'Add this run to Portfolio'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: -4 }]}>
              <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 6 }]}>What this shows</Text>
              <Text style={[styles.helperText, { fontSize: 12.5, lineHeight: 18 }]}>
                {scenarioTakeaway(result)}
              </Text>
            </View>

            <View style={{ marginBottom: 14 }}>
              <AppNativeAd isDarkMode={isDarkMode} />
            </View>
          </>
        )}

        <Text style={styles.disclaimerText}>
          Fully synthetic, randomly generated data based on the settings you chose above — not a real stock, not real market data, and not financial advice.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  screenTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  screenTabChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  screenTabChipActive: {
    borderColor: '#00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  screenTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addToPortfolioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  addToPortfolioBtnDone: {
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  addToPortfolioBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  standardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  standardBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  standardBtnActive: {
    borderColor: '#00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  standardBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D2FF',
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 14,
  },
  calculateBtnDisabled: {
    opacity: 0.5,
  },
  calculateBtnText: {
    color: '#0B0F19',
    fontSize: 14,
    fontWeight: '800',
  },
  skipGateLink: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 14,
    marginTop: -6,
  },
  skipGateLinkText: {
    color: '#00D2FF',
    fontSize: 11.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  growthStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  growthStatVal: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  disclaimerText: {
    fontSize: 10.5,
    lineHeight: 15,
    color: '#64748B',
    fontStyle: 'italic',
    marginBottom: 20,
  },
});
