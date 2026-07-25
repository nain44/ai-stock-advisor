import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, StatusBar, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Home, MessageSquare, Briefcase, Wifi, WifiOff, Settings, AlertCircle, RefreshCw } from 'lucide-react-native';

// Screen Components
import DashboardScreen from './components/DashboardScreen';
import AIChatScreen from './components/AIChatScreen';
import PortfolioScreen from './components/PortfolioScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTicker, setSelectedTicker] = useState('MARI');
  
  // Simulated initial portfolio for standard demo (adds visual weight immediately)
  const [portfolio, setPortfolio] = useState([
    { ticker: 'MARI', quantity: 50, avgPrice: 695.5 },
    { ticker: 'SYS', quantity: 120, avgPrice: 412.0 },
    { ticker: 'FFC', quantity: 300, avgPrice: 138.0 }
  ]);

  // API Connection config & state
  const [apiUrl, setApiUrl] = useState('http://localhost:8000');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState('');

  // Detect network environment
  useEffect(() => {
    // Set to local computer Wi-Fi IP so physical devices on Expo Go can connect
    let defaultUrl = 'http://192.168.100.11:8000';
    setApiUrl(defaultUrl);
    setInputUrl(defaultUrl);
    testConnection(defaultUrl);
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

  const handleSaveApiUrl = () => {
    const formattedUrl = inputUrl.trim().replace(/\/$/, "");
    setApiUrl(formattedUrl);
    testConnection(formattedUrl);
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
          />
        );
      case 'chat':
        return (
          <AIChatScreen
            selectedTicker={selectedTicker}
            portfolio={portfolio}
            apiUrl={apiUrl}
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />

      {/* Global Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>KSE AI Advisor</Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.headerSubtitle}>Pakistan Stock Exchange</Text>
          </View>
        </View>

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
  }
});
