import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Modal, TextInput, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, MessageSquare, Briefcase, Wifi, WifiOff, Settings, AlertCircle, RefreshCw } from 'lucide-react-native';

// Screen Components
import DashboardScreen from './components/DashboardScreen';
import AIChatScreen from './components/AIChatScreen';
import PortfolioScreen from './components/PortfolioScreen';

// Default Local Configuration Cache / Fallback
const DEFAULT_CONFIG = {
  "markets": {
    "PK": {
      "title": "MultiStocks AI",
      "subtitle": "Pakistan Stock Exchange (PSX)",
      "currency": "Rs.",
      "defaultTicker": "MARI",
      "watchlist": ["MARI", "SYS", "MEBL", "HUBC", "OGDC", "UBL"]
    },
    "US": {
      "title": "MultiStocks AI",
      "subtitle": "US Stock Markets (NYSE/NASDAQ)",
      "currency": "$",
      "defaultTicker": "AAPL",
      "watchlist": ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]
    },
    "IN": {
      "title": "MultiStocks AI",
      "subtitle": "National Stock Exchange of India (NSE)",
      "currency": "₹",
      "defaultTicker": "RELIANCE.NS",
      "watchlist": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS"]
    },
    "UK": {
      "title": "MultiStocks AI",
      "subtitle": "London Stock Exchange (LSE)",
      "currency": "£",
      "defaultTicker": "BP.L",
      "watchlist": ["BP.L", "HSBA.L", "GSK.L", "AZN.L", "VOD.L"]
    }
  },
  "chat": {
    "welcome_messages": {
      "PK": "As-salamu alaykum! I am your KSE AI Stock Advisor. Ask me about technical patterns, targets, or specific PSX stocks.",
      "US": "Hello! I am your US Stocks AI Advisor. Ask me about technical patterns, targets, or specific NYSE/NASDAQ stocks.",
      "IN": "Namaste! I am your NSE India AI Stock Advisor. Ask me about technical patterns, targets, or specific Indian stocks.",
      "UK": "Hello! I am your UK Stocks AI Advisor. Ask me about technical patterns, targets, or specific London Stock Exchange (LSE) stocks."
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
      ]
    }
  }
};

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTicker, setSelectedTicker] = useState('MARI');
  const [market, setMarket] = useState('PK');
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
  
  // Simulated initial portfolio for standard demo (adds visual weight immediately)
  const [portfolio, setPortfolio] = useState([
    { ticker: 'MARI', quantity: 50, avgPrice: 695.5 },
    { ticker: 'SYS', quantity: 120, avgPrice: 412.0 },
    { ticker: 'FFC', quantity: 300, avgPrice: 138.0 }
  ]);

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
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
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
        setConfig(data);
        console.log("[App] Configuration loaded from server successfully.");
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
          />
        );
      case 'portfolio':
        return (
          <PortfolioScreen
            portfolio={portfolio}
            setPortfolio={setPortfolio}
            apiUrl={apiUrl}
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Global Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{headerInfo.title}</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.headerSubtitle}>{headerInfo.subtitle}</Text>
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
      <View style={styles.screenContainer}>
        {renderActiveScreen()}
      </View>

      {/* Custom Bottom Tab Navigator */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'dashboard' && styles.activeTabItem]}
          onPress={() => setCurrentTab('dashboard')}
        >
          <Home size={20} color={currentTab === 'dashboard' ? '#00D2FF' : '#64748B'} />
          <Text style={[styles.tabLabel, currentTab === 'dashboard' && styles.activeTabLabel]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'chat' && styles.activeTabItem]}
          onPress={() => setCurrentTab('chat')}
        >
          <MessageSquare size={20} color={currentTab === 'chat' ? '#00D2FF' : '#64748B'} />
          <Text style={[styles.tabLabel, currentTab === 'chat' && styles.activeTabLabel]}>
            AI Advisor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, currentTab === 'portfolio' && styles.activeTabItem]}
          onPress={() => setCurrentTab('portfolio')}
        >
          <Briefcase size={20} color={currentTab === 'portfolio' ? '#00D2FF' : '#64748B'} />
          <Text style={[styles.tabLabel, currentTab === 'portfolio' && styles.activeTabLabel]}>
            Simulator
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
    </SafeAreaView>
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
});
