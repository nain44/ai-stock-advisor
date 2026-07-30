import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { Plus, Trash2, ShieldAlert, CheckCircle2, X, Search, Edit2 } from 'lucide-react-native';

const getCurrencySymbol = (m) => {
  if (m === 'US') return '$';
  if (m === 'IN') return '₹';
  if (m === 'UK') return '£';
  return 'Rs.';
};

export default function PortfolioScreen({ portfolio, setPortfolio, apiUrl, triggerInterstitial, config, market }) {
  const getCurrencySymbol = (m) => {
    const marketConfig = (config && config.markets && config.markets[m]) || {};
    return marketConfig.currency || (m === 'US' ? '$' : m === 'IN' ? '₹' : m === 'UK' ? '£' : 'Rs.');
  };

  const getSuggestions = () => {
    const marketConfig = (config && config.markets && config.markets[market]) || {};
    const watchlist = marketConfig.watchlist || [];
    if (watchlist.length > 0) {
      return watchlist.slice(0, 2).join(', ');
    }
    return market === 'US' ? 'AAPL, MSFT' : 'MARI, SYS';
  };

  const getSignalStatus = (ticker) => {
    const s = stocks.find(item => item.ticker === ticker);
    return s ? s.signal : null;
  };

  const getSignalColor = (sig) => {
    if (!sig) return '#1E293B';
    const s = sig.toUpperCase();
    if (s.includes('BUY')) return '#064E3B';
    if (s.includes('SELL')) return '#7F1D1D';
    return '#1E293B';
  };

  const getSignalTextColor = (sig) => {
    if (!sig) return '#94A3B8';
    const s = sig.toUpperCase();
    if (s.includes('BUY')) return '#34D399';
    if (s.includes('SELL')) return '#F87171';
    return '#94A3B8';
  };

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingHolding, setEditingHolding] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [portfolioAnalysis, setPortfolioAnalysis] = useState(null);

  // Custom Alert Modal state
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error', // 'error', 'warning', 'info', 'confirm'
    onConfirm: null
  });

  const showAlert = (title, message, type = 'error', onConfirm = null) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      type,
      onConfirm
    });
  };

  // Load stocks to get live price information based on the active market and current holdings (with race condition handling)
  useEffect(() => {
    let ignore = false;

    const fetchStocks = async () => {
      try {
        setLoading(true);
        const activeHoldings = portfolio.filter(h => h.market === market);
        const tickersParam = activeHoldings.map(h => h.ticker).join(',');
        
        const url = tickersParam
          ? `${apiUrl}/api/stocks?tickers=${tickersParam}&market=${market}`
          : `${apiUrl}/api/stocks?market=${market}`;
          
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!ignore) {
            setStocks(data);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchStocks();

    return () => {
      ignore = true;
    };
  }, [apiUrl, market, portfolio]);

  // Find live price for any stock ticker
  const getLivePrice = (ticker) => {
    const s = stocks.find(item => item.ticker === ticker);
    return s ? s.current_price : 0;
  };

  const getLiveChange = (ticker) => {
    const s = stocks.find(item => item.ticker === ticker);
    return s ? s.change_percent : 0;
  };

  const getStockName = (ticker) => {
    const s = stocks.find(item => item.ticker === ticker);
    return s ? s.name : ticker;
  };

  // Calculate stats per active market
  let totalCost = 0;
  let totalValue = 0;

  const activeHoldings = portfolio.filter(h => h.market === market);

  activeHoldings.forEach(holding => {
    const livePrice = getLivePrice(holding.ticker) || holding.avgPrice;
    totalCost += holding.avgPrice * holding.quantity;
    totalValue += livePrice * holding.quantity;
  });

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Autocomplete dynamic search handler in Portfolio
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (newTicker.trim().length >= 2) {
        performSearch(newTicker);
      } else {
        setSearchResults([]);
      }
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [newTicker, market]);

  const performSearch = async (query) => {
    try {
      setSearching(true);
      const res = await fetch(`${apiUrl}/api/search?query=${query}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const selectTickerFromSearch = async (tickerSymbol) => {
    setNewTicker(tickerSymbol);
    setSearchResults([]);
    
    // Fetch live price for this selected symbol
    try {
      setAdding(true);
      const res = await fetch(`${apiUrl}/api/stocks?tickers=${tickerSymbol}&market=${market}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const livePrice = data[0].current_price || 100.0;
          setNewPrice(livePrice.toString());
          if (!stocks.some(s => s.ticker === tickerSymbol)) {
            setStocks(prev => [...prev, { ...data[0], current_price: livePrice }]);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  // Handle ticker change in input to pre-populate current live price
  const handleTickerChange = async (ticker) => {
    const cleanTicker = ticker.toUpperCase().trim();
    setNewTicker(cleanTicker);
    
    const livePrice = getLivePrice(cleanTicker);
    if (livePrice > 0) {
      setNewPrice(livePrice.toString());
    } else {
      if (cleanTicker.length >= 3 && cleanTicker.length <= 6) {
        try {
          const res = await fetch(`${apiUrl}/api/stocks?tickers=${cleanTicker}&market=${market}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0 && data[0].current_price > 0) {
              setNewPrice(data[0].current_price.toString());
              if (!stocks.some(s => s.ticker === cleanTicker)) {
                setStocks(prev => [...prev, data[0]]);
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  };

  const handleEditHolding = (holding) => {
    setEditingHolding(holding);
    setNewTicker(holding.ticker);
    setNewQty(holding.quantity.toString());
    setNewPrice(holding.avgPrice.toString());
    setModalVisible(true);
  };

  const handleOpenAddModal = () => {
    setEditingHolding(null);
    setNewTicker('');
    setNewQty('');
    setNewPrice('');
    setModalVisible(true);
  };

  const handleAddHolding = () => {
    if (!newTicker || !newQty || !newPrice) {
      showAlert("Error", "Please fill in all fields.", "error");
      return;
    }

    const qty = parseInt(newQty);
    const price = parseFloat(newPrice);

    if (isNaN(qty) || qty <= 0) {
      showAlert("Error", "Quantity must be a valid positive integer.", "error");
      return;
    }
    if (isNaN(price) || price <= 0) {
      showAlert("Error", "Price must be a valid positive number.", "error");
      return;
    }

    // Check if the ticker exists in coverage list
    const exists = stocks.some(s => s.ticker === newTicker);
    if (!exists && !editingHolding) {
      showAlert(
        "Warning",
        `Ticker ${newTicker} is not currently monitored in KSE coverage list. Adding it might use simulated quotes.`,
        "warning"
      );
    }

    // Add, merge, or edit holding
    const updatedPortfolio = [...portfolio];

    if (editingHolding) {
      const idx = updatedPortfolio.findIndex(
        h => h.ticker === editingHolding.ticker && h.market === editingHolding.market
      );
      if (idx >= 0) {
        updatedPortfolio[idx] = {
          ...updatedPortfolio[idx],
          quantity: qty,
          avgPrice: price
        };
      }
    } else {
      const existingIdx = updatedPortfolio.findIndex(h => h.ticker === newTicker && h.market === market);
      if (existingIdx >= 0) {
        // Merge
        const exist = updatedPortfolio[existingIdx];
        const combinedQty = exist.quantity + qty;
        const combinedCost = (exist.avgPrice * exist.quantity) + (price * qty);
        exist.quantity = combinedQty;
        exist.avgPrice = combinedCost / combinedQty;
      } else {
        // Add new
        updatedPortfolio.push({
          ticker: newTicker,
          quantity: qty,
          avgPrice: price,
          market: market
        });
      }
    }

    setPortfolio(updatedPortfolio);
    setModalVisible(false);
    setEditingHolding(null);
    if (triggerInterstitial) {
      triggerInterstitial();
    }
    // Reset fields
    setNewTicker('');
    setNewQty('');
    setNewPrice('');
  };

  const handleRemoveHolding = (ticker) => {
    showAlert(
      "Confirm Sell/Remove",
      `Are you sure you want to remove ${ticker} from your simulated portfolio?`,
      "confirm",
      () => {
        const updated = portfolio.filter(h => h.ticker !== ticker);
        setPortfolio(updated);
      }
    );
  };

  const handleFetchPortfolioAnalysis = async () => {
    const activeHoldings = portfolio.filter(h => h.market === market);
    if (activeHoldings.length === 0) {
      showAlert("Empty Portfolio", `Please add some ${market} holdings before running diagnostics.`, "warning");
      return;
    }
    try {
      setLoadingAnalysis(true);
      const res = await fetch(`${apiUrl}/api/portfolio/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          portfolio: activeHoldings,
          market: market
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolioAnalysis(data);
        setAnalysisModalVisible(true);
      } else {
        showAlert("Error", "Failed to retrieve portfolio diagnostics.", "error");
      }
    } catch (err) {
      console.error(err);
      showAlert("Connection Error", "Cannot reach the AI Advisor server.", "error");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const getRatingColor = (rating) => {
    if (!rating) return '#94A3B8';
    const r = rating.toLowerCase();
    if (r.includes('well')) return '#34D399';
    if (r.includes('moderate')) return '#F59E0B';
    return '#F87171';
  };

  return (
    <View style={styles.container}>


      {/* Portfolio Header Cards */}
      <View style={styles.headerBox}>
        <Text style={styles.headerLabel}>Simulated Portfolio Value</Text>
        <Text style={styles.headerVal}>{getCurrencySymbol(market)} {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        
        <View style={styles.pnlRow}>
          <Text style={styles.pnlLabel}>Total Return: </Text>
          <Text style={[styles.pnlVal, { color: totalPnL >= 0 ? '#34D399' : '#F87171' }]}>
            {totalPnL >= 0 ? '+' : ''}{getCurrencySymbol(market)} {totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({totalPnLPercent.toFixed(2)}%)
          </Text>
        </View>

        <View style={styles.summaryCostRow}>
          <Text style={styles.summaryCostText}>Total Cost: {getCurrencySymbol(market)} {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.aiDiagnoseBtn, portfolio.length === 0 && { opacity: 0.5 }]} 
          onPress={handleFetchPortfolioAnalysis}
          disabled={portfolio.length === 0 || loadingAnalysis}
        >
          {loadingAnalysis ? (
            <ActivityIndicator size="small" color="#0B0F19" style={{ marginRight: 6 }} />
          ) : null}
          <Text style={styles.aiDiagnoseText}>
            {loadingAnalysis ? "Diagnosing Portfolio..." : "Analyze Portfolio with AI"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Holdings Header */}
      <View style={styles.titleRow}>
        <Text style={styles.titleText}>Your Simulated Holdings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenAddModal}>
          <Plus size={16} color="#0B0F19" style={{ marginRight: 4 }} />
          <Text style={styles.addBtnText}>Add Stock</Text>
        </TouchableOpacity>
      </View>

      {activeHoldings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShieldAlert size={28} color="#64748B" />
          <Text style={styles.emptyText}>No active holdings in your simulated {((config?.markets || {})[market] || {}).name || market} portfolio.</Text>
          <Text style={styles.emptySubText}>Tap 'Add Stock' above to simulate a stock transaction and track performance.</Text>
        </View>
      ) : (
        <ScrollView style={styles.holdingsScroll}>
          {activeHoldings.map((holding) => {
            const livePrice = getLivePrice(holding.ticker) || holding.avgPrice;
            const currentVal = livePrice * holding.quantity;
            const costVal = holding.avgPrice * holding.quantity;
            const holdingPnL = currentVal - costVal;
            const holdingPnLPercent = costVal > 0 ? (holdingPnL / costVal) * 100 : 0;
            const stockName = getStockName(holding.ticker);

            return (
              <View key={holding.ticker} style={styles.holdingCard}>
                <View style={styles.holdingHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                      <Text style={[styles.holdingSymbol, { marginBottom: 0 }]}>{holding.ticker}</Text>
                      {getSignalStatus(holding.ticker) && (
                        <View style={[styles.miniSignalBadge, { backgroundColor: getSignalColor(getSignalStatus(holding.ticker)), borderColor: getSignalTextColor(getSignalStatus(holding.ticker)), marginLeft: 8 }]}>
                          <Text style={[styles.miniSignalText, { color: getSignalTextColor(getSignalStatus(holding.ticker)) }]}>{getSignalStatus(holding.ticker)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.holdingName} numberOfLines={1}>{stockName}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => handleEditHolding(holding)} style={{ marginRight: 16 }}>
                      <Edit2 size={16} color="#00D2FF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRemoveHolding(holding.ticker)}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.statsDivider} />

                <View style={styles.holdingGrid}>
                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Qty / Avg Buy</Text>
                    <Text style={styles.gridVal}>
                      {holding.quantity} @ {getCurrencySymbol(market)}{holding.avgPrice.toFixed(1)}
                    </Text>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Live Price</Text>
                    <Text style={styles.gridVal}>{getCurrencySymbol(market)} {livePrice.toLocaleString()}</Text>
                  </View>
                  <View style={styles.gridCol}>
                    <Text style={styles.gridLabel}>Current Value</Text>
                    <Text style={styles.gridVal}>{getCurrencySymbol(market)} {currentVal.toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.holdingFooter}>
                  <Text style={styles.footerPnLLabel}>Gain / Loss:</Text>
                  <Text style={[styles.footerPnLVal, { color: holdingPnL >= 0 ? '#34D399' : '#F87171' }]}>
                    {holdingPnL >= 0 ? '+' : ''}{getCurrencySymbol(market)} {holdingPnL.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ({holdingPnLPercent.toFixed(2)}%)
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add Holding Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingHolding ? "Edit Simulated Holding" : "Add Simulated Holding"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Stock Ticker</Text>
              {editingHolding ? (
                <View style={[styles.inputField, { backgroundColor: '#1E293B', justifyContent: 'center', height: 40 }]}>
                  <Text style={{ color: '#94A3B8', fontWeight: 'bold' }}>{newTicker}</Text>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Enter stock ticker..."
                    placeholderTextColor="#64748B"
                    value={newTicker}
                    onChangeText={handleTickerChange}
                    autoCapitalize="characters"
                  />
                  
                  {/* Autocomplete overlay for search results */}
                  {searching ? (
                    <View style={styles.searchLoader}>
                      <ActivityIndicator size="small" color="#00D2FF" />
                    </View>
                  ) : searchResults.length > 0 ? (
                    <View style={styles.searchDropdown}>
                      <ScrollView style={{ maxHeight: 120 }} keyboardShouldPersistTaps="handled">
                        {searchResults.map((item) => (
                          <TouchableOpacity
                            key={item.ticker}
                            style={styles.dropdownItem}
                            onPress={() => selectTickerFromSearch(item.ticker)}
                          >
                            <Text style={styles.dropdownTicker}>{item.ticker}</Text>
                            <Text style={styles.dropdownName} numberOfLines={1}>{item.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                  
                  {newTicker.length > 0 && searchResults.length === 0 && (
                    <Text style={styles.helperText}>
                      {stocks.some(s => s.ticker === newTicker)
                        ? `Matching Stock: ${getStockName(newTicker)}`
                        : "Ticker not found in database (will use custom price)"}
                    </Text>
                  )}
                </>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Quantity</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Enter shares quantity..."
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                value={newQty}
                onChangeText={setNewQty}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purchase Price ({getCurrencySymbol(market)} per share)</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.inputField, { flex: 1 }]}
                  placeholder="Enter purchase price..."
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={newPrice}
                  onChangeText={setNewPrice}
                />
                {adding && (
                  <ActivityIndicator size="small" color="#00D2FF" style={{ marginLeft: 10 }} />
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddHolding}>
              <CheckCircle2 size={16} color="#0B0F19" style={{ marginRight: 6 }} />
              <Text style={styles.modalSubmitText}>
                {editingHolding ? "Save Changes" : "Add to Portfolio"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Portfolio Diagnostics Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={analysisModalVisible}
        onRequestClose={() => setAnalysisModalVisible(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Portfolio Diagnostics</Text>
              <TouchableOpacity onPress={() => setAnalysisModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              {portfolioAnalysis && (
                <View>
                  {/* Score Card */}
                  <View style={styles.scoreCard}>
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreGauge}>
                        <Text style={styles.scoreNum}>{portfolioAnalysis.analysis?.health_score}</Text>
                        <Text style={styles.scoreMax}>/100</Text>
                      </View>
                      <View style={{ marginLeft: 16 }}>
                        <Text style={styles.scoreLabel}>Diversification Rating</Text>
                        <Text style={[styles.scoreValue, { color: getRatingColor(portfolioAnalysis.analysis?.diversification_rating) }]}>
                          {portfolioAnalysis.analysis?.diversification_rating}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Analysis Bullets */}
                  <Text style={styles.analysisTitle}>AI Diagnostics & Analysis</Text>
                  <View style={styles.analysisBox}>
                    {portfolioAnalysis.analysis?.analysis_bullets?.map((bullet, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={styles.bulletDot}>•</Text>
                        <Text style={styles.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Rebalancing Advice */}
                  <Text style={styles.analysisTitle}>Actionable Rebalancing Advice</Text>
                  <View style={styles.rebalanceBox}>
                    {portfolioAnalysis.analysis?.rebalancing_actions?.map((action, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <Text style={[styles.bulletDot, { color: '#00D2FF' }]}>➔</Text>
                        <Text style={styles.bulletText}>{action}</Text>
                      </View>
                    ))}
                  </View>
                  
                  {/* Sector Distribution List */}
                  <Text style={styles.analysisTitle}>Sector Allocations</Text>
                  <View style={styles.analysisBox}>
                    {Object.entries(portfolioAnalysis.summary?.sector_allocation || {}).map(([sector, weight]) => (
                      <View key={sector} style={styles.sectorRow}>
                        <Text style={styles.sectorName}>{sector}</Text>
                        <View style={styles.sectorBarWrapper}>
                          <View style={[styles.sectorBar, { width: `${weight}%` }]} />
                        </View>
                        <Text style={styles.sectorWeight}>{weight}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Premium Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={customAlert.visible}
        onRequestClose={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
              {customAlert.type === 'error' && <ShieldAlert size={24} color="#EF4444" />}
              {customAlert.type === 'warning' && <ShieldAlert size={24} color="#F59E0B" />}
              {customAlert.type === 'confirm' && <Trash2 size={24} color="#EC4899" />}
              {customAlert.type === 'info' && <CheckCircle2 size={24} color="#10B981" />}
              <Text style={styles.alertTitle}>{customAlert.title}</Text>
            </View>
            
            <Text style={styles.alertMessage}>{customAlert.message}</Text>
            
            <View style={styles.alertActions}>
              {customAlert.type === 'confirm' ? (
                <>
                  <TouchableOpacity 
                    style={[styles.alertBtn, styles.alertCancelBtn]}
                    onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                  >
                    <Text style={styles.alertCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.alertBtn, styles.alertConfirmBtn]}
                    onPress={() => {
                      if (customAlert.onConfirm) customAlert.onConfirm();
                      setCustomAlert(prev => ({ ...prev, visible: false }));
                    }}
                  >
                    <Text style={styles.alertConfirmBtnText}>Remove</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity 
                  style={[styles.alertBtn, styles.alertOkBtn]}
                  onPress={() => setCustomAlert(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.alertOkBtnText}>Okay</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  headerBox: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  headerLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  headerVal: {
    color: '#00D2FF',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  pnlLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  pnlVal: {
    fontWeight: '700',
    fontSize: 13,
  },
  summaryCostRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#222A3C',
    paddingTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  summaryCostText: {
    color: '#64748B',
    fontSize: 11,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleText: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubText: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  holdingsScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  holdingCard: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  holdingSymbol: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
  },
  holdingName: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    maxWidth: 240,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#222A3C',
    marginVertical: 10,
  },
  holdingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 4,
  },
  gridVal: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  holdingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    backgroundColor: '#0F172A50',
    padding: 8,
    borderRadius: 8,
  },
  footerPnLLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  footerPnLVal: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222A3C',
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  inputField: {
    backgroundColor: '#0F172A',
    color: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#222A3C',
    fontSize: 13,
  },
  helperText: {
    color: '#00D2FF',
    fontSize: 11,
    marginTop: 4,
  },
  modalSubmitBtn: {
    backgroundColor: '#00D2FF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  modalSubmitText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 13,
  },
  searchLoader: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  searchDropdown: {
    backgroundColor: '#0F172A',
    borderColor: '#222A3C',
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222A3C',
  },
  dropdownTicker: {
    color: '#00D2FF',
    fontWeight: 'bold',
    fontSize: 12,
    width: 60,
  },
  dropdownName: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
  },
  aiDiagnoseBtn: {
    backgroundColor: '#00D2FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 14,
    width: '100%',
  },
  aiDiagnoseText: {
    color: '#0B0F19',
    fontWeight: '800',
    fontSize: 13,
  },
  scoreCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreGauge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#00D2FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 210, 255, 0.05)',
  },
  scoreNum: {
    color: '#00D2FF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreMax: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  scoreLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  analysisTitle: {
    color: '#F3F4F6',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 12,
  },
  analysisBox: {
    backgroundColor: '#1E293B50',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  rebalanceBox: {
    backgroundColor: 'rgba(0, 210, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  bulletDot: {
    color: '#EF4444',
    fontSize: 14,
    lineHeight: 18,
    marginRight: 8,
  },
  bulletText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  sectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  sectorName: {
    color: '#94A3B8',
    fontSize: 11,
    width: 110,
  },
  sectorBarWrapper: {
    flex: 1,
    height: 6,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  sectorBar: {
    height: '100%',
    backgroundColor: '#00D2FF',
    borderRadius: 3,
  },
  sectorWeight: {
    color: '#F3F4F6',
    fontSize: 11,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'right',
  },
  marketSwitcherWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0B0F19',
  },
  marketSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1E293B',
    width: '100%',
  },
  switcherBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  switcherBtnActive: {
    backgroundColor: '#00D2FF',
  },
  switcherText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
  },
  switcherTextActive: {
    color: '#0B0F19',
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  alertCard: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  alertTitle: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  alertMessage: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 24,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  alertBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertOkBtn: {
    backgroundColor: '#00D2FF',
    minWidth: 90,
  },
  alertOkBtnText: {
    color: '#0B0F19',
    fontWeight: '700',
    fontSize: 12.5,
  },
  alertCancelBtn: {
    backgroundColor: '#1E293B',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  alertCancelBtnText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 12.5,
  },
  alertConfirmBtn: {
    backgroundColor: '#EF4444',
  },
  alertConfirmBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  countryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B26',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#222A3C',
    alignSelf: 'flex-start',
  },
  dropdownBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
    marginRight: 6,
  },
  dropdownArrow: {
    color: '#00D2FF',
    fontSize: 9,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'flex-end',
  },
  countryModalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  modalDragBar: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  countryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  countryModalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeCountryText: {
    color: '#00D2FF',
    fontSize: 14,
    fontWeight: '600',
  },
  countryScroll: {
    maxHeight: 350,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedCountryItem: {
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
  },
  countryItemFlag: {
    fontSize: 20,
  },
  countryItemName: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCountryItemText: {
    color: '#F8FAFC',
  },
  countryItemSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  selectedCheck: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    height: 20,
  },
  countrySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F19',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
    width: '100%',
  },
  countrySearchIcon: {
    marginRight: 8,
  },
  countrySearchInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    height: '100%',
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  noCountryContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCountryText: {
    color: '#64748B',
    fontSize: 13,
  },
  miniSignalBadge: {
    marginLeft: 6,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  miniSignalText: {
    fontSize: 7,
    fontWeight: 'bold',
  },
});
