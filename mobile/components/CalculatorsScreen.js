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
import { Calculator, Coins, ArrowLeftRight, TrendingUp } from 'lucide-react-native';
import { AppNativeAd } from './AdManager';

const CURRENCY_OPTIONS = ['USD', 'PKR', 'INR', 'GBP', 'EUR', 'AED', 'SAR', 'CAD', 'JPY', 'CNY'];
const GRAMS_PER_TOLA = 11.6638;

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

// Slightly lighter/darker input background than the card, for contrast.
const isBg = (theme) => (theme.bg === '#0B0F19' ? '#0F172A' : '#F1F5F9');

// First calculation in a tool is free; every calculation after that shows an
// interstitial before revealing the (updated) result — unless the user has
// watched a rewarded ad to skip that gate for the rest of the session.
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

// Small link shown after the first calculation, offering to remove the
// interstitial gate for the rest of the session via a rewarded ad.
function SkipGateLink({ visible, theme, triggerRewarded, onUnlocked }) {
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

export default function CalculatorsScreen({ apiUrl, market, triggerInterstitial, triggerRewarded, isDarkMode }) {
  const theme = {
    bg: isDarkMode ? '#0B0F19' : '#F8FAFC',
    card: isDarkMode ? '#161B26' : '#FFFFFF',
    border: isDarkMode ? '#222A3C' : '#E2E8F0',
    text: isDarkMode ? '#FFFFFF' : '#0F172A',
    subtext: isDarkMode ? '#94A3B8' : '#64748B',
  };

  const [activeTool, setActiveTool] = useState('zakat');
  const [skipGateUnlocked, setSkipGateUnlocked] = useState(false);

  const tools = [
    { key: 'zakat', label: 'Zakat', icon: Coins },
    { key: 'currency', label: 'Currency', icon: ArrowLeftRight },
    { key: 'growth', label: 'Growth', icon: TrendingUp },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.headerBlock}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>Calculators & Converters</Text>
        <Text style={[styles.pageSubtitle, { color: theme.subtext }]}>Zakat, currency conversion, and investment growth tools.</Text>
      </View>

      <View style={styles.toolSelectorRow}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.key;
          return (
            <TouchableOpacity
              key={tool.key}
              style={[
                styles.toolChip,
                { backgroundColor: theme.card, borderColor: theme.border },
                isActive && styles.toolChipActive,
              ]}
              onPress={() => setActiveTool(tool.key)}
              activeOpacity={0.8}
            >
              <Icon size={16} color={isActive ? '#00D2FF' : theme.subtext} />
              <Text style={[styles.toolChipText, { color: isActive ? '#00D2FF' : theme.subtext }]}>{tool.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {activeTool === 'zakat' && (
          <ZakatCalculator
            apiUrl={apiUrl}
            market={market}
            theme={theme}
            triggerInterstitial={triggerInterstitial}
            triggerRewarded={triggerRewarded}
            skipGateUnlocked={skipGateUnlocked}
            onUnlockSkipGate={() => setSkipGateUnlocked(true)}
          />
        )}
        {activeTool === 'currency' && (
          <CurrencyConverter
            apiUrl={apiUrl}
            theme={theme}
            triggerInterstitial={triggerInterstitial}
            triggerRewarded={triggerRewarded}
            skipGateUnlocked={skipGateUnlocked}
            onUnlockSkipGate={() => setSkipGateUnlocked(true)}
          />
        )}
        {activeTool === 'growth' && (
          <GrowthCalculator
            market={market}
            theme={theme}
            triggerInterstitial={triggerInterstitial}
            triggerRewarded={triggerRewarded}
            skipGateUnlocked={skipGateUnlocked}
            onUnlockSkipGate={() => setSkipGateUnlocked(true)}
          />
        )}
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChangeText, theme, placeholder, keyboardType = 'numeric' }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.subtext }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: isBg(theme), color: theme.text, borderColor: theme.border }]}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        keyboardType={keyboardType}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

// Weight input that lets the user enter in grams or tola (whichever they know),
// converting to grams internally for the calculation.
function MetalWeightField({ label, amount, onChangeAmount, unit, onChangeUnit, theme }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: theme.subtext }]}>{label}</Text>
      <View style={styles.weightRow}>
        <TextInput
          style={[styles.fieldInput, styles.weightInput, { backgroundColor: isBg(theme), color: theme.text, borderColor: theme.border }]}
          placeholder="0"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
          value={amount}
          onChangeText={onChangeAmount}
        />
        <View style={styles.unitToggle}>
          <TouchableOpacity
            style={[styles.unitBtn, { borderColor: theme.border }, unit === 'gram' && styles.unitBtnActive]}
            onPress={() => onChangeUnit('gram')}
          >
            <Text style={[styles.unitBtnText, { color: unit === 'gram' ? '#00D2FF' : theme.subtext }]}>grams</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.unitBtn, { borderColor: theme.border }, unit === 'tola' && styles.unitBtnActive]}
            onPress={() => onChangeUnit('tola')}
          >
            <Text style={[styles.unitBtnText, { color: unit === 'tola' ? '#00D2FF' : theme.subtext }]}>tola</Text>
          </TouchableOpacity>
        </View>
      </View>
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

const weightToGrams = (amount, unit) => (unit === 'tola' ? toNum(amount) * GRAMS_PER_TOLA : toNum(amount));

function ZakatCalculator({ apiUrl, market, theme, triggerInterstitial, triggerRewarded, skipGateUnlocked, onUnlockSkipGate }) {
  const [nisab, setNisab] = useState(null);
  const [loadingNisab, setLoadingNisab] = useState(true);
  const [cash, setCash] = useState('');
  const [goldAmount, setGoldAmount] = useState('');
  const [goldUnit, setGoldUnit] = useState('tola');
  const [silverAmount, setSilverAmount] = useState('');
  const [silverUnit, setSilverUnit] = useState('tola');
  const [otherAssets, setOtherAssets] = useState('');
  const [liabilities, setLiabilities] = useState('');
  const [standard, setStandard] = useState('silver'); // 'silver' is the more commonly recommended, inclusive threshold
  const [result, setResult] = useState(null);
  const { requestCalculate, hasCalculatedOnce } = useGatedCalculate(triggerInterstitial, skipGateUnlocked);

  useEffect(() => {
    let ignore = false;
    const fetchNisab = async () => {
      try {
        setLoadingNisab(true);
        const res = await fetch(`${apiUrl}/api/zakat/nisab?market=${market}`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) setNisab(data);
        }
      } catch (e) {
        console.warn('Failed to fetch Zakat Nisab data', e);
      } finally {
        if (!ignore) setLoadingNisab(false);
      }
    };
    fetchNisab();
    return () => { ignore = true; };
  }, [apiUrl, market]);

  const currencySymbol = nisab?.currency_symbol || getCurrencySymbol(market);

  const handleCalculate = () => {
    requestCalculate(() => {
      const goldGrams = weightToGrams(goldAmount, goldUnit);
      const silverGrams = weightToGrams(silverAmount, silverUnit);
      const goldValue = goldGrams * (nisab?.gold_price_per_gram || 0);
      const silverValue = silverGrams * (nisab?.silver_price_per_gram || 0);
      const totalAssets = toNum(cash) + goldValue + silverValue + toNum(otherAssets);
      const netZakatable = Math.max(0, totalAssets - toNum(liabilities));
      const nisabThreshold = standard === 'gold' ? (nisab?.nisab_gold_threshold || 0) : (nisab?.nisab_silver_threshold || 0);
      const meetsNisab = nisab ? netZakatable >= nisabThreshold : false;
      const zakatDue = meetsNisab ? netZakatable * 0.025 : 0;
      setResult({ netZakatable, meetsNisab, zakatDue });
    });
  };

  return (
    <View>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Your Zakatable Assets</Text>

        <Field label={`Cash & Bank Balances (${currencySymbol})`} value={cash} onChangeText={setCash} theme={theme} placeholder="0" />

        <MetalWeightField
          label="Gold Owned"
          amount={goldAmount}
          onChangeAmount={setGoldAmount}
          unit={goldUnit}
          onChangeUnit={setGoldUnit}
          theme={theme}
        />
        <MetalWeightField
          label="Silver Owned"
          amount={silverAmount}
          onChangeAmount={setSilverAmount}
          unit={silverUnit}
          onChangeUnit={setSilverUnit}
          theme={theme}
        />
        <Field label={`Other Zakatable Assets (${currencySymbol})`} value={otherAssets} onChangeText={setOtherAssets} theme={theme} placeholder="0" />
        <Field label={`Debts / Liabilities Due (${currencySymbol})`} value={liabilities} onChangeText={setLiabilities} theme={theme} placeholder="0" />
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Nisab Standard</Text>
        <View style={styles.standardRow}>
          <TouchableOpacity
            style={[styles.standardBtn, { borderColor: theme.border }, standard === 'silver' && styles.standardBtnActive]}
            onPress={() => setStandard('silver')}
          >
            <Text style={[styles.standardBtnText, { color: standard === 'silver' ? '#00D2FF' : theme.subtext }]}>Silver (612.36g)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.standardBtn, { borderColor: theme.border }, standard === 'gold' && styles.standardBtnActive]}
            onPress={() => setStandard('gold')}
          >
            <Text style={[styles.standardBtnText, { color: standard === 'gold' ? '#00D2FF' : theme.subtext }]}>Gold (87.48g)</Text>
          </TouchableOpacity>
        </View>
        {loadingNisab ? (
          <ActivityIndicator size="small" color="#00D2FF" style={{ marginTop: 10 }} />
        ) : nisab ? (
          <Text style={styles.helperText}>
            Current Nisab threshold ({standard}): {currencySymbol} {formatMoney(standard === 'gold' ? nisab.nisab_gold_threshold : nisab.nisab_silver_threshold)} (from real gold/silver spot prices)
          </Text>
        ) : (
          <Text style={styles.helperText}>Could not load current Nisab data.</Text>
        )}
      </View>

      <CalculateButton onPress={handleCalculate} disabled={loadingNisab || !nisab} label={result ? 'Recalculate' : 'Calculate Zakat'} />
      <SkipGateLink
        visible={hasCalculatedOnce && !skipGateUnlocked}
        theme={theme}
        triggerRewarded={triggerRewarded}
        onUnlocked={onUnlockSkipGate}
      />

      {result && (
        <>
          <View style={[styles.resultCard, { backgroundColor: 'rgba(0, 210, 255, 0.08)', borderColor: '#00D2FF' }]}>
            <Text style={[styles.resultLabel, { color: theme.subtext }]}>Net Zakatable Wealth</Text>
            <Text style={[styles.resultValue, { color: theme.text }]}>{currencySymbol} {formatMoney(result.netZakatable)}</Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: result.meetsNisab ? '#34D399' : '#94A3B8' }]} />
              <Text style={[styles.statusText, { color: result.meetsNisab ? '#34D399' : theme.subtext }]}>
                {result.meetsNisab ? 'Above Nisab — Zakat is due' : 'Below Nisab — no Zakat due'}
              </Text>
            </View>

            <Text style={[styles.resultLabel, { color: theme.subtext, marginTop: 12 }]}>Estimated Zakat Due (2.5%)</Text>
            <Text style={styles.zakatDueValue}>{currencySymbol} {formatMoney(result.zakatDue)}</Text>
          </View>
          <View style={{ marginBottom: 14 }}>
            <AppNativeAd isDarkMode={theme.bg === '#0B0F19'} />
          </View>
        </>
      )}

      <Text style={styles.disclaimerText}>
        This is a general estimate for convenience only, based on real gold/silver spot prices — it is not a religious
        ruling (fatwa). Zakat also requires the wealth to have been held for a full lunar year (Hawl), which this
        calculator does not track. Please confirm your specific situation with a qualified scholar.
      </Text>
    </View>
  );
}

function CurrencyConverter({ apiUrl, theme, triggerInterstitial, triggerRewarded, skipGateUnlocked, onUnlockSkipGate }) {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('1');
  const [fromCcy, setFromCcy] = useState('USD');
  const [toCcy, setToCcy] = useState('PKR');
  const [result, setResult] = useState(null);
  const { requestCalculate, hasCalculatedOnce } = useGatedCalculate(triggerInterstitial, skipGateUnlocked);

  useEffect(() => {
    let ignore = false;
    const fetchRates = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiUrl}/api/forex/rates`);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) setRates(data.rates || null);
        }
      } catch (e) {
        console.warn('Failed to fetch forex rates', e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchRates();
    return () => { ignore = true; };
  }, [apiUrl]);

  const handleCalculate = () => {
    if (!rates) return;
    requestCalculate(() => {
      const fromRate = rates[fromCcy] || 1;
      const toRate = rates[toCcy] || 1;
      const converted = (toNum(amount) / fromRate) * toRate;
      setResult({ amount: toNum(amount), fromCcy, toCcy, converted, rate: toRate / fromRate });
    });
  };

  const CurrencyPicker = ({ selected, onSelect }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyRow}>
      {CURRENCY_OPTIONS.map((ccy) => (
        <TouchableOpacity
          key={ccy}
          style={[
            styles.currencyChip,
            { borderColor: theme.border },
            selected === ccy && styles.currencyChipActive,
          ]}
          onPress={() => onSelect(ccy)}
        >
          <Text style={[styles.currencyChipText, { color: selected === ccy ? '#00D2FF' : theme.subtext }]}>{ccy}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>Amount</Text>
        <TextInput
          style={[styles.fieldInput, styles.amountInput, { backgroundColor: isBg(theme), color: theme.text, borderColor: theme.border }]}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          placeholderTextColor="#64748B"
        />

        <Text style={[styles.fieldLabel, { color: theme.subtext, marginTop: 14 }]}>From</Text>
        <CurrencyPicker selected={fromCcy} onSelect={setFromCcy} />

        <TouchableOpacity
          style={styles.swapBtn}
          onPress={() => { setFromCcy(toCcy); setToCcy(fromCcy); }}
        >
          <ArrowLeftRight size={16} color="#00D2FF" />
          <Text style={styles.swapBtnText}>Swap</Text>
        </TouchableOpacity>

        <Text style={[styles.fieldLabel, { color: theme.subtext }]}>To</Text>
        <CurrencyPicker selected={toCcy} onSelect={setToCcy} />
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#00D2FF" style={{ marginTop: 10 }} />
      ) : (
        <>
          <CalculateButton onPress={handleCalculate} disabled={!rates} label={result ? 'Recalculate' : 'Convert'} />
          <SkipGateLink
            visible={hasCalculatedOnce && !skipGateUnlocked}
            theme={theme}
            triggerRewarded={triggerRewarded}
            onUnlocked={onUnlockSkipGate}
          />
        </>
      )}

      {result && (
        <>
          <View style={[styles.resultCard, { backgroundColor: 'rgba(0, 210, 255, 0.08)', borderColor: '#00D2FF' }]}>
            <Text style={[styles.resultLabel, { color: theme.subtext }]}>{formatMoney(result.amount)} {result.fromCcy} =</Text>
            <Text style={[styles.resultValue, { color: theme.text }]}>{formatMoney(result.converted)} {result.toCcy}</Text>
            <Text style={styles.helperText}>1 {result.fromCcy} = {result.rate.toFixed(4)} {result.toCcy}</Text>
          </View>
          <View style={{ marginBottom: 14 }}>
            <AppNativeAd isDarkMode={theme.bg === '#0B0F19'} />
          </View>
        </>
      )}
      <Text style={styles.disclaimerText}>Live exchange rates, updated hourly. Not PSX/exchange stock data.</Text>
    </View>
  );
}

function GrowthCalculator({ market, theme, triggerInterstitial, triggerRewarded, skipGateUnlocked, onUnlockSkipGate }) {
  const [mode, setMode] = useState('project'); // 'project' | 'cagr'

  // Growth Projection mode
  const [initial, setInitial] = useState('100000');
  const [monthly, setMonthly] = useState('5000');
  const [rate, setRate] = useState('12');
  const [years, setYears] = useState('10');

  // CAGR mode
  const [startVal, setStartVal] = useState('100000');
  const [endVal, setEndVal] = useState('200000');
  const [cagrYears, setCagrYears] = useState('5');

  const [result, setResult] = useState(null);
  const { requestCalculate, hasCalculatedOnce } = useGatedCalculate(triggerInterstitial, skipGateUnlocked);

  const currencySymbol = getCurrencySymbol(market);

  const handleCalculateProjection = () => {
    requestCalculate(() => {
      const monthlyRate = toNum(rate) / 100 / 12;
      const months = Math.round(toNum(years) * 12);
      let balance = toNum(initial);
      let totalContributed = toNum(initial);
      for (let i = 0; i < months; i++) {
        balance = balance * (1 + monthlyRate) + toNum(monthly);
        totalContributed += toNum(monthly);
      }
      setResult({
        mode: 'project',
        futureValue: balance,
        totalContributed,
        totalGrowth: balance - totalContributed,
      });
    });
  };

  const handleCalculateCagr = () => {
    requestCalculate(() => {
      const s = toNum(startVal);
      const e = toNum(endVal);
      const y = toNum(cagrYears);
      const cagr = (s > 0 && y > 0) ? (Math.pow(e / s, 1 / y) - 1) * 100 : 0;
      setResult({ mode: 'cagr', cagr });
    });
  };

  return (
    <View>
      <View style={styles.standardRow}>
        <TouchableOpacity
          style={[styles.standardBtn, { borderColor: theme.border }, mode === 'project' && styles.standardBtnActive]}
          onPress={() => setMode('project')}
        >
          <Text style={[styles.standardBtnText, { color: mode === 'project' ? '#00D2FF' : theme.subtext }]}>Growth Projection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.standardBtn, { borderColor: theme.border }, mode === 'cagr' && styles.standardBtnActive]}
          onPress={() => setMode('cagr')}
        >
          <Text style={[styles.standardBtnText, { color: mode === 'cagr' ? '#00D2FF' : theme.subtext }]}>Find CAGR</Text>
        </TouchableOpacity>
      </View>

      {mode === 'project' ? (
        <>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Investment Growth Projection</Text>
            <Field label={`Initial Investment (${currencySymbol})`} value={initial} onChangeText={setInitial} theme={theme} placeholder="0" />
            <Field label={`Monthly Contribution (${currencySymbol})`} value={monthly} onChangeText={setMonthly} theme={theme} placeholder="0" />
            <Field label="Expected Annual Return (%)" value={rate} onChangeText={setRate} theme={theme} placeholder="12" />
            <Field label="Investment Period (years)" value={years} onChangeText={setYears} theme={theme} placeholder="10" />
          </View>

          <CalculateButton onPress={handleCalculateProjection} label={(result && result.mode === 'project') ? 'Recalculate' : 'Calculate Growth'} />
          <SkipGateLink
            visible={hasCalculatedOnce && !skipGateUnlocked}
            theme={theme}
            triggerRewarded={triggerRewarded}
            onUnlocked={onUnlockSkipGate}
          />

          {result && result.mode === 'project' && (
            <>
              <View style={[styles.resultCard, { backgroundColor: 'rgba(0, 210, 255, 0.08)', borderColor: '#00D2FF' }]}>
                <Text style={[styles.resultLabel, { color: theme.subtext }]}>Projected Future Value</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{currencySymbol} {formatMoney(result.futureValue)}</Text>
                <View style={styles.growthStatsRow}>
                  <View>
                    <Text style={styles.helperText}>Total Contributed</Text>
                    <Text style={[styles.growthStatVal, { color: theme.text }]}>{currencySymbol} {formatMoney(result.totalContributed)}</Text>
                  </View>
                  <View>
                    <Text style={styles.helperText}>Total Growth</Text>
                    <Text style={[styles.growthStatVal, { color: '#34D399' }]}>{currencySymbol} {formatMoney(result.totalGrowth)}</Text>
                  </View>
                </View>
              </View>
              <View style={{ marginBottom: 14 }}>
                <AppNativeAd isDarkMode={theme.bg === '#0B0F19'} />
              </View>
            </>
          )}
        </>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Compound Annual Growth Rate</Text>
            <Field label={`Starting Value (${currencySymbol})`} value={startVal} onChangeText={setStartVal} theme={theme} placeholder="0" />
            <Field label={`Ending Value (${currencySymbol})`} value={endVal} onChangeText={setEndVal} theme={theme} placeholder="0" />
            <Field label="Holding Period (years)" value={cagrYears} onChangeText={setCagrYears} theme={theme} placeholder="5" />
          </View>

          <CalculateButton onPress={handleCalculateCagr} label={(result && result.mode === 'cagr') ? 'Recalculate' : 'Calculate CAGR'} />
          <SkipGateLink
            visible={hasCalculatedOnce && !skipGateUnlocked}
            theme={theme}
            triggerRewarded={triggerRewarded}
            onUnlocked={onUnlockSkipGate}
          />

          {result && result.mode === 'cagr' && (
            <>
              <View style={[styles.resultCard, { backgroundColor: 'rgba(0, 210, 255, 0.08)', borderColor: '#00D2FF' }]}>
                <Text style={[styles.resultLabel, { color: theme.subtext }]}>CAGR</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{result.cagr.toFixed(2)}%</Text>
              </View>
              <View style={{ marginBottom: 14 }}>
                <AppNativeAd isDarkMode={theme.bg === '#0B0F19'} />
              </View>
            </>
          )}
        </>
      )}
      <Text style={styles.disclaimerText}>
        Estimates only, based on your inputs — not a forecast or guarantee of actual returns. Not financial advice.
      </Text>
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
  toolSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
  },
  toolChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
  },
  toolChipActive: {
    borderColor: '#00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  toolChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 12,
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
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    flex: 1,
  },
  unitToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  unitBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  unitBtnActive: {
    borderColor: '#00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  unitBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountInput: {
    fontSize: 20,
    fontWeight: '700',
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
  zakatDueValue: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    color: '#00D2FF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  currencyRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  currencyChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },
  currencyChipActive: {
    borderColor: '#00D2FF',
    backgroundColor: 'rgba(0, 210, 255, 0.08)',
  },
  currencyChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  swapBtnText: {
    color: '#00D2FF',
    fontSize: 12,
    fontWeight: '700',
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
