import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Modal, TextInput, Platform, Animated, Easing, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppBannerAd, MockInterstitialModal, MockRewardedModal } from './components/AdManager';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, MessageSquare, Briefcase, Wifi, WifiOff, Settings, AlertCircle, RefreshCw, Menu, X, Sun, Moon, DollarSign } from 'lucide-react-native';

// Screen Components
import DashboardScreen from './components/DashboardScreen';
import AIChatScreen from './components/AIChatScreen';
import PortfolioScreen from './components/PortfolioScreen';

// Default Local Configuration Cache / Fallback
const DEFAULT_CONFIG = {
  "markets": {
    "PK": {
      "name": "Pakistan",
      "flag": "🇵🇰",
      "title": "MultiStocks AI",
      "subtitle": "Pakistan Stock Exchange (PSX)",
      "currency": "Rs.",
      "defaultTicker": "MARI",
      "watchlist": ["MARI", "SYS", "MEBL", "HUBC", "OGDC", "UBL"]
    },
    "US": {
      "name": "United States",
      "flag": "🇺🇸",
      "title": "MultiStocks AI",
      "subtitle": "US Stock Markets (NYSE/NASDAQ)",
      "currency": "$",
      "defaultTicker": "AAPL",
      "watchlist": ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]
    },
    "IN": {
      "name": "India",
      "flag": "🇮🇳",
      "title": "MultiStocks AI",
      "subtitle": "National Stock Exchange of India (NSE)",
      "currency": "₹",
      "defaultTicker": "RELIANCE.NS",
      "watchlist": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"]
    },
    "UK": {
      "name": "United Kingdom",
      "flag": "🇬🇧",
      "title": "MultiStocks AI",
      "subtitle": "London Stock Exchange (LSE)",
      "currency": "£",
      "defaultTicker": "BP.L",
      "watchlist": ["BP.L", "HSBA.L", "GSK.L", "AZN.L", "VOD.L"]
    },
    "CA": {
      "name": "Canada",
      "flag": "🇨🇦",
      "title": "MultiStocks AI",
      "subtitle": "Toronto Stock Exchange (TSX)",
      "currency": "C$",
      "defaultTicker": "RY.TO",
      "watchlist": ["RY.TO", "TD.TO", "SHOP.TO", "ENB.TO"]
    },
    "JP": {
      "name": "Japan",
      "flag": "🇯🇵",
      "title": "MultiStocks AI",
      "subtitle": "Tokyo Stock Exchange (TSE)",
      "currency": "¥",
      "defaultTicker": "7203.T",
      "watchlist": ["7203.T", "6758.T", "9984.T"]
    },
    "DE": {
      "name": "Germany",
      "flag": "🇩🇪",
      "title": "MultiStocks AI",
      "subtitle": "Frankfurt Stock Exchange (DAX)",
      "currency": "€",
      "defaultTicker": "SAP.DE",
      "watchlist": ["SAP.DE", "SIE.DE", "ALV.DE", "VOW3.DE"]
    },
    "AU": {
      "name": "Australia",
      "flag": "🇦🇺",
      "title": "MultiStocks AI",
      "subtitle": "Australian Securities Exchange (ASX)",
      "currency": "A$",
      "defaultTicker": "BHP.AX",
      "watchlist": ["BHP.AX", "CBA.AX", "RIO.AX", "TLS.AX"]
    },
    "SA": {
      "name": "Saudi Arabia",
      "flag": "🇸🇦",
      "title": "MultiStocks AI",
      "subtitle": "Saudi Stock Exchange (TADAWUL)",
      "currency": "SAR",
      "defaultTicker": "2222.SR",
      "watchlist": ["2222.SR", "1120.SR", "1150.SR"]
    },
    "AE": {
      "name": "United Arab Emirates",
      "flag": "🇦🇪",
      "title": "MultiStocks AI",
      "subtitle": "Dubai Financial Market (DFM)",
      "currency": "AED",
      "defaultTicker": "EMAAR.DU",
      "watchlist": ["EMAAR.DU", "DEWA.DU", "DFM.DU"]
    },
    "CN": {
      "name": "China",
      "flag": "🇨🇳",
      "title": "MultiStocks AI",
      "subtitle": "Shanghai Stock Exchange (SSE)",
      "currency": "¥",
      "defaultTicker": "601398.SS",
      "watchlist": ["601398.SS", "600519.SS", "601857.SS", "600028.SS"]
    },
    "QA": {
      "name": "Qatar",
      "flag": "🇶🇦",
      "title": "MultiStocks AI",
      "subtitle": "Qatar Stock Exchange (QSE)",
      "currency": "QR",
      "defaultTicker": "QNBK.QA",
      "watchlist": ["QNBK.QA", "QGTS.QA", "IQCD.QA", "QEWS.QA"]
    },
    "EG": {
      "name": "Egypt",
      "flag": "🇪🇬",
      "title": "MultiStocks AI",
      "subtitle": "Egyptian Exchange (EGX)",
      "currency": "E£",
      "defaultTicker": "COMI.CA",
      "watchlist": ["COMI.CA", "EAST.CA", "SWDY.CA", "FWRY.CA"]
    },
    "IR": {
      "name": "Iran",
      "flag": "🇮🇷",
      "title": "MultiStocks AI",
      "subtitle": "Iran Markets (IRR Proxy Feed)",
      "currency": "IRR",
      "defaultTicker": "IRR=X",
      "watchlist": ["IRR=X", "GC=F", "SI=F"]
    },
    "TR": {
      "name": "Turkey",
      "flag": "🇹🇷",
      "title": "MultiStocks AI",
      "subtitle": "Borsa Istanbul (BIST)",
      "currency": "₺",
      "defaultTicker": "THYAO.IS",
      "watchlist": ["THYAO.IS", "ASELS.IS", "AKBNK.IS", "EREGL.IS", "TUPRS.IS"]
    }
  },
  "chat": {
    "welcome_messages": {
      "PK": "As-salamu alaykum! I am your KSE AI Stock Advisor. Ask me about technical patterns, targets, or specific PSX stocks.",
      "US": "Hello! I am your US Stocks AI Advisor. Ask me about technical patterns, targets, or specific NYSE/NASDAQ stocks.",
      "IN": "Namaste! I am your NSE India AI Stock Advisor. Ask me about technical patterns, targets, or specific Indian stocks.",
      "UK": "Hello! I am your UK Stocks AI Advisor. Ask me about technical patterns, targets, or specific London Stock Exchange (LSE) stocks.",
      "CA": "Hello! I am your TSX Canada AI Stock Advisor. Ask me about technical patterns, targets, or specific Canadian stocks.",
      "JP": "Konnichiwa! I am your Tokyo Stock Exchange AI Advisor. Ask me about technical indicators, targets, or specific Japanese stocks.",
      "DE": "Guten Tag! I am your German Markets AI Advisor. Ask me about technical patterns, targets, or specific DAX equities.",
      "AU": "G'day! I am your ASX Australia AI Stock Advisor. Ask me about technical indicators, targets, or specific Australian stocks.",
      "SA": "Marhaban! I am your Saudi Tadawul AI Advisor. Ask me about technical analysis, targets, or specific Saudi stocks.",
      "AE": "Marhaban! I am your UAE Stock Markets AI Advisor. Ask me about DFM/ADX technical analysis, targets, or specific UAE equities.",
      "CN": "Nǐ hǎo! I am your Shanghai Stock Exchange AI Advisor. Ask me about technical patterns, targets, or specific SSE stocks.",
      "QA": "Marhaban! I am your Qatar Stock Exchange AI Advisor. Ask me about technical indicators, targets, or specific Qatari stocks.",
      "EG": "Ahlan bik! I am your Egyptian Exchange AI Advisor. Ask me about technical analysis, targets, or specific EGX stocks.",
      "IR": "Dorood! I am your Iranian Markets AI Advisor. Ask me about Rial exchange rates, bullion gold/silver targets, or custom tickers.",
      "TR": "Merhaba! I am your Borsa Istanbul AI Advisor. Ask me about technical indicators, targets, or specific Turkish stocks."
    },
    "suggestion_chips": {
      "PK": [
        {"label": "Analyze MARI", "query": "Can you do a full analysis of MARI and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading PSX?"},
        {"label": "Top Defensive Stocks", "query": "Which stocks in the PSX coverage are considered the best defensive/dividend stocks?"}
      ],
      "US": [
        {"label": "Analyze AAPL", "query": "Can you do a full analysis of AAPL and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading US markets?"},
        {"label": "Top Defensive Stocks", "query": "Which stocks in the US markets coverage are considered the best defensive/dividend stocks?"}
      ],
      "IN": [
        {"label": "Analyze RELIANCE.NS", "query": "Can you do a full analysis of RELIANCE.NS and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading NSE?"},
        {"label": "Top Defensive Stocks", "query": "Which stocks in the NSE coverage are considered the best defensive/dividend stocks?"}
      ],
      "UK": [
        {"label": "Analyze BP.L", "query": "Can you do a full analysis of BP.L and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading LSE?"},
        {"label": "Top Defensive Stocks", "query": "Which stocks in the LSE coverage are considered the best defensive/dividend stocks?"}
      ],
      "CA": [
        {"label": "Analyze RY.TO", "query": "Can you do a full analysis of RY.TO and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading TSX?"},
        {"label": "Top Defensive Stocks", "query": "Which stocks in the TSX coverage are considered the best defensive/dividend stocks?"}
      ],
      "JP": [
        {"label": "Analyze Toyota", "query": "Can you do an analysis of 7203.T (Toyota) and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading JPY markets?"},
        {"label": "Top Growth Stocks", "query": "Which stocks in the Tokyo stock list are considered the best tech/growth stocks?"}
      ],
      "DE": [
        {"label": "Analyze SAP", "query": "Can you do a full analysis of SAP.DE and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading German markets?"},
        {"label": "Top Industrial Equities", "query": "Which stocks in the DAX coverage are considered the best industrial/manufacturing stocks?"}
      ],
      "AU": [
        {"label": "Analyze BHP", "query": "Can you do a full analysis of BHP.AX and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading ASX?"},
        {"label": "Top Resource Stocks", "query": "Which resource/mining stocks in the ASX coverage are recommended?"}
      ],
      "SA": [
        {"label": "Analyze Aramco", "query": "Can you do a full analysis of 2222.SR (Saudi Aramco) and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading Tadawul?"},
        {"label": "Top Banking Equities", "query": "Which banking stocks in the Saudi market are considered the best?"}
      ],
      "AE": [
        {"label": "Analyze Emaar", "query": "Can you do a full analysis of EMAAR.DU and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading DFM?"},
        {"label": "Top Real Estate Stocks", "query": "Which developers/property stocks in UAE coverage are recommended?"}
      ],
      "CN": [
        {"label": "Analyze ICBC", "query": "Can you do a full analysis of 601398.SS and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading SSE?"},
        {"label": "Top SSE Equities", "query": "Which stocks in the SSE coverage are considered the best defensive/dividend stocks?"}
      ],
      "QA": [
        {"label": "Analyze QNB", "query": "Can you do a full analysis of QNBK.QA and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading QSE?"},
        {"label": "Top QSE Equities", "query": "Which banking/financial stocks in the QSE coverage are recommended?"}
      ],
      "EG": [
        {"label": "Analyze CIB Egypt", "query": "Can you do a full analysis of COMI.CA and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading EGX?"},
        {"label": "Top EGX Equities", "query": "Which industrial and digital payment stocks in EGX coverage are recommended?"}
      ],
      "IR": [
        {"label": "Analyze Gold Proxy", "query": "Can you do a full technical analysis of GC=F (Gold Spot) and explain targets?"},
        {"label": "Check Rial Stance", "query": "What are the latest technical projections for IRR=X (USD/IRR exchange rate)?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading forex and commodities?"},
        {"label": "Top Hedging Options", "query": "Which precious metal commodities in my coverage are the best hedges against inflation?"}
      ],
      "TR": [
        {"label": "Analyze Turkish Airlines", "query": "Can you do a full analysis of THYAO.IS and explain target levels?"},
        {"label": "Check Portfolio Stance", "query": "Based on my simulated portfolio holdings, what changes do you recommend?"},
        {"label": "Explain RSI and MACD", "query": "What are RSI and MACD, and how should I use them for trading BIST?"},
        {"label": "Top BIST Equities", "query": "Which industrial or banking stocks in BIST coverage are recommended?"}
      ]
    }
  }
};

const CurrencyConverterWidget = ({ isDarkMode }) => {
  const [amount, setAmount] = useState('100');
  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('PKR');
  const [converted, setConverted] = useState(null);

  const rates = {
    USD: 1.0,
    PKR: 278.5,
    INR: 83.5,
    GBP: 0.78,
    EUR: 0.92,
    TRY: 33.1
  };

  const handleConvert = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setConverted(0);
      return;
    }
    const valInUSD = amt / rates[fromCur];
    const valInTarget = valInUSD * rates[toCur];
    setConverted(valInTarget);
  };

  useEffect(() => {
    handleConvert();
  }, [amount, fromCur, toCur]);

  return (
    <View style={[styles.sidebarCard, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF' }]}>
      <Text style={[styles.sidebarCardTitle, { color: isDarkMode ? '#00D2FF' : '#0284C7' }]}>Currency Converter</Text>
      
      <Text style={[styles.sidebarInputLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Amount</Text>
      <TextInput
        style={[styles.sidebarInput, { 
          backgroundColor: isDarkMode ? '#374151' : '#F1F5F9',
          color: isDarkMode ? '#FFF' : '#000',
          borderColor: isDarkMode ? '#4B5563' : '#CBD5E1'
        }]}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
        <View style={{ width: '45%' }}>
          <Text style={[styles.sidebarInputLabel, { color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 4 }]}>From</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {['USD', 'PKR', 'INR', 'TRY'].map(cur => (
              <TouchableOpacity 
                key={cur}
                onPress={() => setFromCur(cur)}
                style={[
                  styles.curSelectBtn, 
                  fromCur === cur && { backgroundColor: '#00D2FF' },
                  fromCur !== cur && { backgroundColor: isDarkMode ? '#374151' : '#E2E8F0' }
                ]}
              >
                <Text style={{ fontSize: 10, color: fromCur === cur ? '#0B0F19' : (isDarkMode ? '#FFF' : '#0F172A'), fontWeight: 'bold' }}>{cur}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ width: '45%' }}>
          <Text style={[styles.sidebarInputLabel, { color: isDarkMode ? '#94A3B8' : '#64748B', marginBottom: 4 }]}>To</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {['USD', 'PKR', 'INR', 'TRY'].map(cur => (
              <TouchableOpacity 
                key={cur}
                onPress={() => setToCur(cur)}
                style={[
                  styles.curSelectBtn, 
                  toCur === cur && { backgroundColor: '#00D2FF' },
                  toCur !== cur && { backgroundColor: isDarkMode ? '#374151' : '#E2E8F0' }
                ]}
              >
                <Text style={{ fontSize: 10, color: toCur === cur ? '#0B0F19' : (isDarkMode ? '#FFF' : '#0F172A'), fontWeight: 'bold' }}>{cur}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.resultBox, { backgroundColor: isDarkMode ? '#111827' : '#F8FAFC', borderColor: isDarkMode ? '#374151' : '#E2E8F0' }]}>
        <Text style={{ color: isDarkMode ? '#94A3B8' : '#64748B', fontSize: 11 }}>Result</Text>
        <Text style={{ color: isDarkMode ? '#10B981' : '#059669', fontSize: 14, fontWeight: 'bold', marginTop: 2 }}>
          {parseFloat(amount || 0).toLocaleString()} {fromCur} = 
        </Text>
        <Text style={{ color: '#34D399', fontSize: 16, fontWeight: 'bold' }}>
          {converted ? converted.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} {toCur}
        </Text>
      </View>
    </View>
  );
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarRendered, setSidebarRendered] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const sidebarAnim = useRef(new Animated.Value(-320)).current;

  // Load theme on startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const val = await AsyncStorage.getItem('@is_dark_mode');
        if (val !== null) {
          setIsDarkMode(val === 'true');
        }
      } catch (e) {
        // ignore
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async (mode) => {
    setIsDarkMode(mode);
    try {
      await AsyncStorage.setItem('@is_dark_mode', mode ? 'true' : 'false');
    } catch (e) {
      // ignore
    }
  };

  const toggleSidebar = () => {
    if (!sidebarOpen) {
      setSidebarRendered(true);
      Animated.timing(sidebarAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();
      setSidebarOpen(true);
    } else {
      Animated.timing(sidebarAnim, {
        toValue: -320,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start(() => {
        setSidebarRendered(false);
      });
      setSidebarOpen(false);
    }
  };
  const [selectedTicker, setSelectedTicker] = useState('MARI');
  const [market, setMarket] = useState('PK');
  const [isMarketLoaded, setIsMarketLoaded] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const spinValue = useRef(new Animated.Value(0)).current;

  const handleManualRefresh = () => {
    spinValue.setValue(0);
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    setRefreshTrigger(prev => prev + 1);
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Load/detect market region on startup
  useEffect(() => {
    const initializeMarket = async () => {
      try {
        const storedMarket = await AsyncStorage.getItem('@multistocks_market');
        if (storedMarket && DEFAULT_CONFIG.markets[storedMarket]) {
          setMarket(storedMarket);
          setIsMarketLoaded(true);
        } else {
          // If no manually selected market is saved, auto-detect location via IP
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          
          const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            const data = await res.json();
            const countryCode = data.country_code?.toUpperCase();
            if (countryCode && DEFAULT_CONFIG.markets[countryCode]) {
              setMarket(countryCode);
              console.log(`[App] Auto-detected country on startup: ${countryCode}`);
            }
          }
          setIsMarketLoaded(true);
        }
      } catch (e) {
        console.warn("Failed to load or auto-detect market on mount:", e);
        setIsMarketLoaded(true); // fall back to PK default
      }
    };
    initializeMarket();
  }, []);

  // Save market to persistent storage on changes
  useEffect(() => {
    if (!isMarketLoaded) return;
    AsyncStorage.setItem('@multistocks_market', market).catch(e => console.error(e));
  }, [market, isMarketLoaded]);
  
  // Simulated initial portfolio for standard demo (adds visual weight immediately)
  const [portfolio, setPortfolio] = useState([]);
  const [isPortfolioLoaded, setIsPortfolioLoaded] = useState(false);

  // Load portfolio from device persistent local storage on mount
  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        const stored = await AsyncStorage.getItem('@multistocks_portfolio');
        if (stored) {
          setPortfolio(JSON.parse(stored));
        } else {
          // Default initial simulated holdings for demo purposes
          const defaultPortfolio = [
            { ticker: 'MARI', quantity: 50, avgPrice: 695.5 },
            { ticker: 'SYS', quantity: 120, avgPrice: 412.0 },
            { ticker: 'FFC', quantity: 300, avgPrice: 138.0 }
          ];
          setPortfolio(defaultPortfolio);
        }
        setIsPortfolioLoaded(true);
      } catch (e) {
        console.warn("Failed to load portfolio from local storage", e);
        setIsPortfolioLoaded(true);
      }
    };
    loadPortfolio();
  }, []);

  // Save portfolio to local storage when changed
  useEffect(() => {
    if (!isPortfolioLoaded) return;
    const savePortfolio = async () => {
      try {
        await AsyncStorage.setItem('@multistocks_portfolio', JSON.stringify(portfolio));
      } catch (e) {
        console.error("Failed to save portfolio to local storage", e);
      }
    };
    savePortfolio();
  }, [portfolio, isPortfolioLoaded]);

  // Synchronize default selected stock when the global market or config changes
  useEffect(() => {
    const marketConfig = (config && config.markets && config.markets[market]) || DEFAULT_CONFIG.markets[market] || {};
    const defaultTicker = marketConfig.defaultTicker || 'MARI';
    setSelectedTicker(defaultTicker);
  }, [market, config]);

  // API Connection config & state
  const [apiUrl, setApiUrl] = useState('https://ai-stock-advisor-sp9b.onrender.com');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState('');

  // Detect network environment
  useEffect(() => {
    // Point to live Render API deployment
    let defaultUrl = 'https://ai-stock-advisor-sp9b.onrender.com';
    setApiUrl(defaultUrl);
    setInputUrl(defaultUrl);
    testConnection(defaultUrl);
    fetchConfig(defaultUrl);
  }, []);

  const testConnection = async (url) => {
    try {
      setConnectionStatus('connecting');
      // Simple timeout fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(`${url}/api/settings`, { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('disconnected');
      }
    } catch (e) {
      console.warn("Connection test failed", e);
      setConnectionStatus('disconnected');
    }
  };

  const fetchConfig = async (url) => {
    try {
      const res = await fetch(`${url}/api/config`);
      if (res.ok) {
        const data = await res.json();
        
        // Merge server configuration with local DEFAULT_CONFIG to prevent losing new global markets
        const mergedMarkets = {
          ...DEFAULT_CONFIG.markets,
          ...(data.markets || {})
        };
        const mergedWelcome = {
          ...DEFAULT_CONFIG.chat.welcome_messages,
          ...(data.chat?.welcome_messages || {})
        };
        const mergedSuggestions = {
          ...DEFAULT_CONFIG.chat.suggestion_chips,
          ...(data.chat?.suggestion_chips || {})
        };
        
        setConfig({
          markets: mergedMarkets,
          chat: {
            welcome_messages: mergedWelcome,
            suggestion_chips: mergedSuggestions
          }
        });
        console.log("[App] Configuration loaded and merged from server successfully.");
      }
    } catch (e) {
      console.warn("Failed to load server configuration, using local fallback cache.", e);
    }
  };

  const handleSaveApiUrl = () => {
    const formattedUrl = inputUrl.trim().replace(/\/$/, "");
    setApiUrl(formattedUrl);
    testConnection(formattedUrl);
    fetchConfig(formattedUrl);
    setConfigModalVisible(false);
  };

  // Monetization Ad States and AI credits
  const [aiCredits, setAiCredits] = useState(3);
  const [interstitialVisible, setInterstitialVisible] = useState(false);
  const [rewardedVisible, setRewardedVisible] = useState(false);

  const triggerInterstitial = () => {
    setInterstitialVisible(true);
  };

  const triggerRewarded = () => {
    setRewardedVisible(true);
  };

  const renderActiveScreen = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            selectedTicker={selectedTicker}
            setSelectedTicker={setSelectedTicker}
            apiUrl={apiUrl}
            market={market}
            setMarket={setMarket}
            config={config}
            refreshTrigger={refreshTrigger}
            isDarkMode={isDarkMode}
          />
        );
      case 'chat':
        return (
          <AIChatScreen
            selectedTicker={selectedTicker}
            portfolio={portfolio}
            apiUrl={apiUrl}
            market={market}
            config={config}
            aiCredits={aiCredits}
            setAiCredits={setAiCredits}
            triggerRewarded={triggerRewarded}
            isDarkMode={isDarkMode}
          />
        );
      case 'portfolio':
        return (
          <PortfolioScreen
            portfolio={portfolio}
            setPortfolio={setPortfolio}
            apiUrl={apiUrl}
            triggerInterstitial={triggerInterstitial}
            config={config}
            market={market}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return <View style={styles.flexEmpty} />;
    }
  };

  const getHeaderInfo = () => {
    const marketConfig = (config && config.markets && config.markets[market]) || DEFAULT_CONFIG.markets[market] || {};
    return {
      title: marketConfig.title || 'MultiStocks AI',
      subtitle: marketConfig.subtitle || ''
    };
  };

  const headerInfo = getHeaderInfo();

  return (
    <View style={{ flex: 1, backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={isDarkMode ? "#0B0F19" : "#F8FAFC"} />

        {/* Global Header */}
        <View style={[styles.header, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderBottomColor: isDarkMode ? '#222A3C' : '#E2E8F0' }]}>
          <View style={styles.headerLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={toggleSidebar} style={{ marginRight: 12 }}>
                <Menu size={22} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
              <View>
                <Text style={[styles.headerTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>{headerInfo.title}</Text>
                <View style={styles.subtitleRow}>
                  <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#64748B' : '#475569' }]}>{headerInfo.subtitle}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.headerRightContainer}>
            {/* Animated manual refresh button */}
            <TouchableOpacity 
              style={styles.refreshHeaderBtn}
              onPress={handleManualRefresh}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <RefreshCw size={14} color="#94A3B8" />
              </Animated.View>
            </TouchableOpacity>

            {/* API connection trigger badge */}
            <TouchableOpacity 
              style={[styles.connectionBadge, styles[`status_${connectionStatus}`]]}
              onPress={() => {
                setInputUrl(apiUrl);
                setConfigModalVisible(true);
              }}
            >
              {connectionStatus === 'connected' ? (
                <Wifi size={14} color="#34D399" />
              ) : connectionStatus === 'connecting' ? (
                <RefreshCw size={14} color="#FBBF24" style={styles.spinAnimation} />
              ) : (
                <WifiOff size={14} color="#F87171" />
              )}
              <Text style={[styles.connectionText, { 
                color: connectionStatus === 'connected' ? '#34D399' : 
                       connectionStatus === 'connecting' ? '#FBBF24' : '#F87171' 
              }]}>
                {connectionStatus === 'connected' ? 'Live API' : 
                 connectionStatus === 'connecting' ? 'Connecting' : 'Offline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Screen Content */}
        <View style={[styles.screenContainer, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}>
          {renderActiveScreen()}
        </View>

        {/* Sticky Bottom Ad Banner */}
        <AppBannerAd isDarkMode={isDarkMode} />

        {/* Custom Bottom Tab Navigator */}
        <View style={[styles.tabBar, { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderTopColor: isDarkMode ? '#222A3C' : '#E2E8F0' }]}>
          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'dashboard' && styles.activeTabItem]}
            onPress={() => setCurrentTab('dashboard')}
          >
            <Home size={20} color={currentTab === 'dashboard' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8')} />
            <Text style={[styles.tabLabel, currentTab === 'dashboard' && styles.activeTabLabel, { color: currentTab === 'dashboard' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8') }]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'chat' && styles.activeTabItem]}
            onPress={() => setCurrentTab('chat')}
          >
            <MessageSquare size={20} color={currentTab === 'chat' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8')} />
            <Text style={[styles.tabLabel, currentTab === 'chat' && styles.activeTabLabel, { color: currentTab === 'chat' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8') }]}>
              AI Advisor
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, currentTab === 'portfolio' && styles.activeTabItem]}
            onPress={() => setCurrentTab('portfolio')}
          >
            <Briefcase size={20} color={currentTab === 'portfolio' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8')} />
            <Text style={[styles.tabLabel, currentTab === 'portfolio' && styles.activeTabLabel, { color: currentTab === 'portfolio' ? '#00D2FF' : (isDarkMode ? '#64748B' : '#94A3B8') }]}>
              Portfolio
            </Text>
          </TouchableOpacity>
        </View>

        {/* API Connection Setup Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={configModalVisible}
          onRequestClose={() => setConfigModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Settings size={20} color="#00D2FF" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>API Server Configuration</Text>
              </View>

              <Text style={styles.modalDesc}>
                FastAPI backend connection. Set this to your workstation IP if running on physical device on the same Wi-Fi.
              </Text>

              <View style={styles.inputBox}>
                <Text style={styles.inputLabel}>Endpoint URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={inputUrl}
                  onChangeText={setInputUrl}
                  placeholder="http://192.168.x.x:8000"
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {connectionStatus === 'disconnected' && (
                <View style={styles.alertBox}>
                  <AlertCircle size={16} color="#F87171" style={{ marginRight: 6 }} />
                  <Text style={styles.alertText}>Currently unable to reach backend service.</Text>
                </View>
              )}

              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.testBtn]}
                  onPress={() => testConnection(inputUrl)}
                >
                  <Text style={styles.testBtnText}>Test Connect</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.saveBtn]}
                  onPress={handleSaveApiUrl}
                >
                  <Text style={styles.saveBtnText}>Save & Apply</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.closeModalBtn}
                onPress={() => setConfigModalVisible(false)}
              >
                <Text style={styles.closeModalText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Root monetization ad overlays */}
        <MockInterstitialModal 
          visible={interstitialVisible} 
          onClose={() => setInterstitialVisible(false)} 
        />
        <MockRewardedModal 
          visible={rewardedVisible} 
          onClose={() => setRewardedVisible(false)} 
          onRewardEarned={() => setAiCredits(prev => prev + 3)}
        />
      </SafeAreaView>

      {/* Sidebar Drawer Overlay */}
      {sidebarOpen && (
        <TouchableOpacity 
          style={styles.sidebarOverlay} 
          activeOpacity={1} 
          onPress={toggleSidebar} 
        />
      )}

      {/* Sidebar Drawer Panel */}
      {sidebarRendered && (
        <Animated.View style={[styles.sidebarPanel, { transform: [{ translateX: sidebarAnim }], backgroundColor: isDarkMode ? '#111827' : '#F1F5F9', borderRightColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.sidebarHeader, { borderBottomColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
              <Text style={[styles.sidebarTitle, { color: isDarkMode ? '#FFF' : '#0F172A' }]}>Advisor Tools</Text>
              <TouchableOpacity onPress={toggleSidebar}>
                <X size={20} color={isDarkMode ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarContent}>
              {/* Theme Toggle Widget */}
              <View style={[styles.sidebarCard, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF', borderColor: isDarkMode ? '#374151' : '#E2E8F0' }]}>
                <Text style={[styles.sidebarCardTitle, { color: isDarkMode ? '#00D2FF' : '#0284C7' }]}>Theme Settings</Text>
                <TouchableOpacity 
                  style={[styles.themeToggleBtn, { backgroundColor: isDarkMode ? '#374151' : '#E2E8F0' }]}
                  onPress={() => toggleTheme(!isDarkMode)}
                >
                  {isDarkMode ? (
                    <>
                      <Moon size={16} color="#FBBF24" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Dark Mode</Text>
                    </>
                  ) : (
                    <>
                      <Sun size={16} color="#EA580C" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>Light Mode</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Currency Converter Widget */}
              <CurrencyConverterWidget isDarkMode={isDarkMode} />
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  flexEmpty: {
    flex: 1,
  },
  header: {
    height: 60,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F3F4F6',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  status_connected: {
    backgroundColor: '#064E3B40',
    borderColor: '#059669',
  },
  status_connecting: {
    backgroundColor: '#78350F40',
    borderColor: '#D97706',
  },
  status_disconnected: {
    backgroundColor: '#7F1D1D40',
    borderColor: '#DC2626',
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    height: 64,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingBottom: Platform.OS === 'ios' ? 14 : 6,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabItem: {
    borderTopWidth: 0,
  },
  tabLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#00D2FF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
  },
  modalDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputBox: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#0B0F19',
    color: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222A3C',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7F1D1D20',
    borderColor: '#7F1D1D50',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  alertText: {
    color: '#F87171',
    fontSize: 11.5,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testBtn: {
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  testBtnText: {
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12.5,
  },
  saveBtn: {
    backgroundColor: '#00D2FF',
    marginLeft: 8,
  },
  saveBtnText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 12.5,
  },
  closeModalBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeModalText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  spinAnimation: {
    // Note: CSS-based animation is simplified in React Native
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshHeaderBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 999,
  },
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: '#111827',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  sidebarHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sidebarContent: {
    padding: 16,
  },
  sidebarCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  sidebarCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  sidebarInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  sidebarInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  curSelectBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    minWidth: 42,
    alignItems: 'center',
  },
  resultBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});
