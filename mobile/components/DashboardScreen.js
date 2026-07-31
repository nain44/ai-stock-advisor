import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNativeAd } from './AdManager';
import Svg, { Path, Defs, LinearGradient, Stop, Rect, Line, Text as SvgText } from 'react-native-svg';
import { TrendingUp, TrendingDown, ShieldAlert, Award, Compass, RefreshCw, BarChart2, Trash2, Plus, Search } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ selectedTicker, setSelectedTicker, apiUrl, market, setMarket, config, refreshTrigger, isDarkMode }) {
  const theme = {
    bg: isDarkMode ? '#0B0F19' : '#F8FAFC',
    card: isDarkMode ? '#161B26' : '#FFFFFF',
    border: isDarkMode ? '#222A3C' : '#E2E8F0',
    text: isDarkMode ? '#FFFFFF' : '#0F172A',
    subtext: isDarkMode ? '#94A3B8' : '#64748B',
    headerBg: isDarkMode ? '#0F172A' : '#FFFFFF',
    headerBorder: isDarkMode ? '#1E293B' : '#E2E8F0',
  };

  const getCurrencySymbol = (m) => {
    const marketConfig = (config && config.markets && config.markets[m]) || {};
    return marketConfig.currency || (m === 'US' ? '$' : m === 'IN' ? '₹' : m === 'UK' ? '£' : 'Rs.');
  };

  const [stocks, setStocks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [historical, setHistorical] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [sortBy, setSortBy] = useState('Default');
  const [sectorModalVisible, setSectorModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [activeModalStock, setActiveModalStock] = useState(null);

  // Watchlists for localized stock management (persistent local states)
  const [watchlists, setWatchlists] = useState({});
  const [isWatchlistLoaded, setIsWatchlistLoaded] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');

  // 1. Load watchlists from AsyncStorage on mount
  useEffect(() => {
    const loadWatchlists = async () => {
      try {
        const stored = await AsyncStorage.getItem('@multistocks_watchlists_dict');
        if (stored) {
          setWatchlists(JSON.parse(stored));
        } else {
          setWatchlists({});
        }
        setIsWatchlistLoaded(true);
      } catch (e) {
        console.warn("Failed to load watchlists from local storage", e);
        setIsWatchlistLoaded(true);
      }
    };
    loadWatchlists();
  }, []);

  // 2. Sync default watchlists from backend config if empty
  useEffect(() => {
    if (!isWatchlistLoaded) return;

    setWatchlists(prev => {
      const updated = { ...prev };
      let changed = false;
      const markets = config?.markets || {};
      
      Object.keys(markets).forEach(m => {
        if (!updated[m] || updated[m].length === 0) {
          updated[m] = markets[m].watchlist || [];
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, [config, isWatchlistLoaded]);

  // 3. Save watchlists on updates
  useEffect(() => {
    if (!isWatchlistLoaded || Object.keys(watchlists).length === 0) return;
    AsyncStorage.setItem('@multistocks_watchlists_dict', JSON.stringify(watchlists)).catch(e => console.error(e));
  }, [watchlists, isWatchlistLoaded]);

  // Derive watchlist dynamically based on the active market to avoid race conditions
  const watchlist = React.useMemo(() => {
    return watchlists[market] || (config?.markets || {})[market]?.watchlist || [];
  }, [market, watchlists, config]);

  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [macroData, setMacroData] = useState(null);
  const [loadingMacro, setLoadingMacro] = useState(false);

  // refreshTrigger is consumed dynamically as a prop from the global App header

  // Fetch Commodities & Forex exchange rates dynamically when the market changes
  useEffect(() => {
    let ignore = false;
    const fetchMacroData = async () => {
      try {
        setLoadingMacro(true);
        const res = await fetch(`${apiUrl}/api/macro?market=${market}`);
        if (!res.ok) throw new Error("Failed to load macro indicators");
        const data = await res.json();
        if (!ignore) {
          setMacroData(data);
        }
      } catch (err) {
        console.warn("Failed to retrieve commodities/forex data", err);
      } finally {
        if (!ignore) {
          setLoadingMacro(false);
        }
      }
    };
    fetchMacroData();
    return () => {
      ignore = true;
    };
  }, [apiUrl, market, refreshTrigger]);

  // Fetch stocks on watchlist, API URL, or market changes (with race condition handling)
  useEffect(() => {
    let ignore = false;
    
    const fetchStocks = async () => {
      try {
        setLoadingStocks(true);
        const tickersParam = watchlist.join(',');
        const url = `${apiUrl}/api/stocks?tickers=${tickersParam}&market=${market}`;
        console.log("[fetchStocks] URL:", url);
        const res = await fetch(url);
        console.log("[fetchStocks] Status:", res.status, "OK:", res.ok);
        if (!res.ok) throw new Error("Failed to load stocks list");
        const data = await res.json();
        
        if (!ignore) {
          setStocks(data);
          if (data.length > 0 && !selectedTicker) {
            setSelectedTicker(data[0].ticker);
          }
          setError(null);
        }
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setError("Cannot connect to server. Check API URL.");
        }
      } finally {
        if (!ignore) {
          setLoadingStocks(false);
        }
      }
    };

    fetchStocks();

    return () => {
      ignore = true;
    };
  }, [apiUrl, watchlist, market, refreshTrigger]);

  // Autocomplete dynamic search handler
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [searchQuery, apiUrl, market]);

  const performSearch = async () => {
    try {
      setSearching(true);
      const res = await fetch(`${apiUrl}/api/search?query=${searchQuery}&market=${market}`);
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

  // Timeframe state
  const [timeframe, setTimeframe] = useState('1M');
  const [chartType, setChartType] = useState('line');

  // Fetch analysis when selectedTicker or market changes (with race condition handling)
  useEffect(() => {
    if (!selectedTicker) return;
    
    // Clear previous analysis to prevent showing stale stock data while loading
    setAnalysis(null);
    
    let ignore = false;
    
    const fetchAnalysis = async (ticker) => {
      try {
        setLoadingAnalysis(true);
        const analysisRes = await fetch(`${apiUrl}/api/analysis/${ticker}?market=${market}`);
        if (!analysisRes.ok) throw new Error("Failed to load analysis");
        const analysisData = await analysisRes.json();
        
        if (!ignore) {
          setAnalysis(analysisData);
          
          // Update signal in stocks list state to keep it synchronized!
          if (analysisData.recommendation?.recommendation) {
            setStocks(prevStocks => prevStocks.map(s => 
              s.ticker === ticker ? { ...s, signal: analysisData.recommendation.recommendation } : s
            ));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!ignore) {
          setLoadingAnalysis(false);
        }
      }
    };

    fetchAnalysis(selectedTicker);

    return () => {
      ignore = true;
    };
  }, [selectedTicker, apiUrl, market, refreshTrigger]);

  // Fetch history when selectedTicker, timeframe, or market changes (with race condition handling)
  useEffect(() => {
    if (!selectedTicker) return;

    // Clear previous historical data to prevent showing stale charts while loading
    setHistorical([]);

    let ignore = false;
    let days = 30;
    if (timeframe === '1D') days = 2;
    else if (timeframe === '3D') days = 3;
    else if (timeframe === '1W') days = 7;
    else if (timeframe === '1M') days = 30;
    else if (timeframe === '3M') days = 90;
    else if (timeframe === '6M') days = 180;
    else if (timeframe === '1Y') days = 365;
    else if (timeframe === '3Y') days = 1095;

    const fetchHistory = async (ticker, daysNum) => {
      try {
        console.log(`[Frontend] Fetching history for ${ticker}, daysNum=${daysNum}, market=${market}`);
        const historicalRes = await fetch(`${apiUrl}/api/historical/${ticker}?days=${daysNum}&market=${market}`);
        if (historicalRes.ok) {
          const historicalData = await historicalRes.json();
          console.log(`[Frontend] Received ${historicalData.length} records. Dates:`, historicalData.map(d => d.Date || d.date));
          if (!ignore) {
            setHistorical(historicalData);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchHistory(selectedTicker, days);

    return () => {
      ignore = true;
    };
  }, [selectedTicker, timeframe, apiUrl, market, refreshTrigger]);

  // Sparkline Chart SVG Path Generator
  const generateSparklinePaths = (data, w, h) => {
    if (!data || data.length < 2) return { linePath: '', areaPath: '' };
    const prices = data.map(d => d.Close || d.close || d.Price || 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const padding = 5;
    const chartH = h - 2 * padding;

    const points = prices.map((price, idx) => {
      const x = (idx / (prices.length - 1)) * w;
      const y = h - padding - ((price - min) / range) * chartH;
      return { x, y };
    });

    const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

    return { linePath, areaPath };
  };

  // Candlestick Chart SVG Coordinates Generator
  const generateCandles = (data, w, h) => {
    if (!data || data.length === 0) return [];
    
    // Find min and max across all High and Low values to scale correctly
    const highs = data.map(d => d.High || d.high || d.Close || d.close || 0);
    const lows = data.map(d => d.Low || d.low || d.Close || d.close || 0);
    const minPrice = Math.min(...lows);
    const maxPrice = Math.max(...highs);
    const priceRange = maxPrice - minPrice || 1;
    const padding = 5;
    const chartH = h - 2 * padding;
    
    const n = data.length;
    // Calculate candle width. Leave 35% gap between candles
    const rawCandleW = w / n;
    const gap = rawCandleW * 0.35;
    const candleW = Math.max(1.5, rawCandleW - gap);
    
    return data.map((item, idx) => {
      const open = item.Open || item.open || item.Close || item.close || 0;
      const high = item.High || item.high || item.Close || item.close || 0;
      const low = item.Low || item.low || item.Close || item.close || 0;
      const close = item.Close || item.close || 0;
      
      const scaleY = (val) => {
        return h - padding - ((val - minPrice) / priceRange) * chartH;
      };
      
      const x = idx * rawCandleW + gap / 2;
      const yHigh = scaleY(high);
      const yLow = scaleY(low);
      const yOpen = scaleY(open);
      const yClose = scaleY(close);
      
      const isGreen = close >= open;
      const color = isGreen ? '#10B981' : '#EF4444';
      
      const bodyH = Math.max(1.5, Math.abs(yOpen - yClose));
      const bodyY = Math.min(yOpen, yClose);
      
      return {
        x,
        yHigh,
        yLow,
        bodyX: x,
        bodyY,
        bodyW: candleW,
        bodyH,
        color,
        wickX: x + candleW / 2
      };
    });
  };

  // Format Date label for X-axis (e.g. "2026-07-28" to "07/28")
  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}`;
    }
    return dateStr;
  };

  const handleAddWatchlist = (ticker) => {
    const uppercaseTicker = ticker.trim().toUpperCase();
    setWatchlists(prev => {
      const currentList = prev[market] || [];
      if (currentList.includes(uppercaseTicker)) return prev;
      return {
        ...prev,
        [market]: [...currentList, uppercaseTicker]
      };
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleRemoveWatchlist = (ticker) => {
    const uppercaseTicker = ticker.trim().toUpperCase();
    setWatchlists(prev => {
      const currentList = prev[market] || [];
      return {
        ...prev,
        [market]: currentList.filter(t => t !== uppercaseTicker)
      };
    });
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

  const renderRecommendationBadge = (rec) => {
    const val = rec.toLowerCase();
    let bg = '#1E293B';
    let text = '#94A3B8';

    if (val.includes('buy')) {
      bg = '#064E3B';
      text = '#34D399';
    } else if (val.includes('sell')) {
      bg = '#7F1D1D';
      text = '#F87171';
    } else if (val.includes('hold')) {
      bg = '#78350F';
      text = '#FBBF24';
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color: text }]}>{rec.toUpperCase()}</Text>
      </View>
    );
  };

  if (loadingStocks && stocks.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color="#00D2FF" />
        <Text style={[styles.loadingText, { color: theme.subtext }]}>Fetching Live Market Coverage...</Text>
      </View>
    );
  }

  const selectedStockObj = stocks.find(s => s.ticker === selectedTicker) || {};

  const sectors = ['All', ...new Set(stocks.map(s => s.sector))];

  const formatVolume = (vol) => {
    if (!vol) return '0';
    if (vol >= 1000000) {
      return (vol / 1000000).toFixed(2) + 'M';
    } else if (vol >= 1000) {
      return (vol / 1000).toFixed(1) + 'K';
    }
    return vol.toString();
  };

  const filteredStocks = stocks.filter(stock => {
    const matchesSearch = stock.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          stock.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === 'All' || searchQuery.trim() !== '' || stock.sector === selectedSector;
    return matchesSearch && matchesSector;
  }).sort((a, b) => {
    if (sortBy === 'Volume') {
      return b.volume - a.volume;
    } else if (sortBy === 'Gainers') {
      return b.change_percent - a.change_percent;
    } else if (sortBy === 'Losers') {
      return a.change_percent - b.change_percent;
    }
    return 0;
  });

  const getIndexValAndChange = () => {
    switch (market) {
      case 'US':
        return { name: 'S&P 500', val: '5,459.10', change: '+48.30 (+0.89%)', positive: true };
      case 'IN':
        return { name: 'NIFTY 50', val: '24,315.90', change: '+102.50 (+0.42%)', positive: true };
      case 'UK':
        return { name: 'FTSE 100', val: '8,185.30', change: '-24.10 (-0.29%)', positive: false };
      default:
        return { name: 'KSE100', val: '171,021', change: '-718 (-0.42%)', positive: false };
    }
  };
  const renderMacroWidget = () => {
    if (!macroData) return null;
    
    return (
      <View style={styles.macroContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.macroScrollContent}
        >
          {/* Commodities */}
          {macroData.commodities?.map((item, idx) => {
            const isUp = item.pct_change >= 0;
            const priceLabel = item.localized ? item.localized.price : `${getCurrencySymbol('US')}${item.price}`;
            const unitLabel = item.localized ? item.localized.label : `${item.name} (${item.ticker})`;
            
            return (
              <View key={`commodity-${idx}`} style={[styles.macroCard, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                <View style={styles.macroCardHeader}>
                  <View style={[styles.macroDot, { backgroundColor: item.name === 'Gold' ? '#F59E0B' : item.name === 'Silver' ? '#94A3B8' : '#34D399' }]} />
                  <Text style={styles.macroUnitLabel} numberOfLines={1}>{unitLabel}</Text>
                </View>
                <Text style={[styles.macroPrice, !isDarkMode && { color: '#0F172A' }]}>{priceLabel}</Text>
                <View style={styles.macroChangeRow}>
                  <Text style={[styles.macroChangeText, isUp ? styles.positiveText : styles.negativeText]}>
                    {isUp ? '▲' : '▼'} {Math.abs(item.pct_change).toFixed(2)}%
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Forex */}
          {macroData.forex?.map((item, idx) => {
            return (
              <View key={`forex-${idx}`} style={[styles.macroCard, styles.forexCard, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
                <Text style={[styles.forexPair, !isDarkMode && { color: '#0284C7' }]}>{item.pair}</Text>
                <Text style={[styles.forexRate, !isDarkMode && { color: '#0F172A' }]}>{item.rate}</Text>
                <Text style={styles.forexSub}>Live Forex Rate</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const idxInfo = getIndexValAndChange();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Market Switcher & Index Banner Header Row */}
      <View style={[styles.headerIndexRow, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={styles.indexBannerCompact}>
          <View>
            <Text style={[styles.indexName, { color: theme.subtext }]}>{idxInfo.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.indexVal, { color: theme.text }]}>{idxInfo.val}</Text>
              <Text style={idxInfo.positive ? styles.indexChangePositive : styles.indexChangeNegative}>{idxInfo.change}</Text>
            </View>
          </View>
        </View>
        
        {/* Country Selector Dropdown Button */}
        <TouchableOpacity 
          style={[styles.countryDropdownBtn, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0', borderColor: theme.border }]}
          onPress={() => setCountryModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownBtnText, { color: theme.text }]}>
            {((config?.markets || {})[market] || {}).flag || '🌐'} {market}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Commodities and Forex Rates Bar */}
      {renderMacroWidget()}

      {/* Search Bar */}
      <View style={styles.searchBarRow}>
        <View style={[styles.searchInputContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Search size={18} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInputField, { color: theme.text }]}
            placeholder={market === 'US' ? "Search global US stocks..." : "Search all 500+ PSX stocks..."}
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        {/* Dynamic Autocomplete Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={[styles.searchResultsContainer, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            {searchResults.map((result) => {
              const alreadyAdded = watchlist.some(t => t.trim().toUpperCase() === result.ticker.trim().toUpperCase());
              return (
                <TouchableOpacity 
                  key={result.ticker} 
                  style={[styles.searchResultItem, !isDarkMode && { borderBottomColor: '#E2E8F0' }]}
                  onPress={() => {
                    if (!alreadyAdded) {
                      handleAddWatchlist(result.ticker);
                    }
                    setSelectedTicker(result.ticker); // Focus and select the newly added stock immediately!
                    setTimeframe('1M'); // Reset to default 1 Month timeframe when focusing a stock!
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <View style={styles.resultDetails}>
                    <Text style={[styles.resultTicker, !isDarkMode && { color: '#0F172A' }]}>{result.ticker}</Text>
                    <Text style={[styles.resultName, !isDarkMode && { color: '#64748B' }]} numberOfLines={1}>{result.name}</Text>
                  </View>
                  <View style={styles.resultAction}>
                    {alreadyAdded ? (
                      <Text style={styles.alreadyAddedText}>Added</Text>
                    ) : (
                      <View style={styles.addBtn}>
                        <Plus size={12} color="#FFF" />
                        <Text style={styles.addBtnText}>Add</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Filters Row */}
      <View style={styles.filtersRow}>
        <TouchableOpacity style={[styles.filterBtn, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]} onPress={() => setSectorModalVisible(true)}>
          <Text style={[styles.filterBtnText, !isDarkMode && { color: '#0F172A' }]} numberOfLines={1}>
            Sector: {selectedSector}
          </Text>
          <Text style={[styles.arrowDown, !isDarkMode && { color: '#64748B' }]}>▼</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.filterBtn, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]} onPress={() => setSortModalVisible(true)}>
          <Text style={[styles.filterBtnText, !isDarkMode && { color: '#0F172A' }]} numberOfLines={1}>
            Sort By: {sortBy}
          </Text>
          <Text style={[styles.arrowDown, !isDarkMode && { color: '#64748B' }]}>▼</Text>
        </TouchableOpacity>
      </View>

      {/* Vertical Stocks List */}
      <ScrollView style={styles.stocksScroll} contentContainerStyle={styles.stocksListContent}>
        {loadingStocks ? (
          <View style={styles.listLoaderContainer}>
            <ActivityIndicator size="large" color="#00D2FF" />
            <Text style={styles.listLoaderText}>Updating watchlist data...</Text>
          </View>
        ) : filteredStocks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No stocks match your search/filter criteria.</Text>
          </View>
        ) : (
          filteredStocks.map((stock, index) => {
            const isUp = stock.change >= 0;
            const isSelected = stock.ticker === selectedTicker;
            const initials = stock.ticker.substring(0, 2);
            
            // Assign custom emblem colors by sector
            const emblemColors = {
              "Technology (IT Services)": "#8B5CF6",
              "Oil & Gas Exploration": "#3B82F6",
              "Cement": "#F59E0B",
              "Conglomerates": "#EF4444",
              "Fertilizer": "#10B981",
              "Commercial Banks": "#06B6D4",
              "Oil & Gas Marketing": "#EC4899"
            };
            const defaultColor = emblemColors[stock.sector] || "#64748B";
            const emblemBg = stock.signal === 'BUY' ? '#10B981' : (stock.signal === 'SELL' ? '#EF4444' : defaultColor);

            return (
              <React.Fragment key={stock.ticker}>
                <TouchableOpacity
                  style={[
                    styles.stockRow, 
                    isSelected && styles.selectedStockRow,
                    !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
                    isSelected && !isDarkMode && { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' }
                  ]}
                  onPress={() => {
                    setSelectedTicker(stock.ticker);
                    setActiveModalStock(stock);
                    setTimeframe('1M'); // Reset to default 1 Month timeframe when opening a stock's details!
                    setDetailModalVisible(true);
                  }}
                >
                  {/* Left Emblem & Name */}
                  <View style={styles.stockLeft}>
                    <View style={[styles.emblem, { backgroundColor: emblemBg }]}>
                      <Text style={styles.emblemText}>{initials}</Text>
                    </View>
                    <View style={styles.nameCol}>
                      <Text style={[styles.stockTickerText, !isDarkMode && { color: '#0F172A' }]}>{stock.ticker}</Text>
                      <Text style={[styles.stockNameText, !isDarkMode && { color: '#64748B' }]} numberOfLines={1}>
                        {stock.name}
                      </Text>
                    </View>
                  </View>

                  {/* Center 2x2 Grid */}
                  <View style={styles.stockCenter}>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCell}>
                        <Text style={[styles.gridLabel, !isDarkMode && { color: '#64748B' }]}>HIGH</Text>
                        <Text style={[styles.gridNum, !isDarkMode && { color: '#334155' }]}>{stock.high?.toFixed(2) || '0.00'}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={[styles.gridLabel, !isDarkMode && { color: '#64748B' }]}>LOW</Text>
                        <Text style={[styles.gridNum, !isDarkMode && { color: '#334155' }]}>{stock.low?.toFixed(2) || '0.00'}</Text>
                      </View>
                    </View>
                    <View style={styles.gridRow}>
                      <View style={styles.gridCell}>
                        <Text style={[styles.gridLabel, !isDarkMode && { color: '#64748B' }]}>VOLUME</Text>
                        <Text style={[styles.gridNum, !isDarkMode && { color: '#334155' }]}>{formatVolume(stock.volume)}</Text>
                      </View>
                      <View style={styles.gridCell}>
                        <Text style={[styles.gridLabel, !isDarkMode && { color: '#64748B' }]}>LDCP</Text>
                        <Text style={[styles.gridNum, !isDarkMode && { color: '#334155' }]}>{stock.ldcp?.toFixed(2) || '0.00'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Price & Change */}
                  <View style={styles.stockRight}>
                    <Text style={[styles.stockPriceText, !isDarkMode && { color: '#0F172A' }]}>
                      {stock.current_price?.toFixed(2) || '0.00'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end', marginTop: 4 }}>
                      <View style={{ alignItems: 'center', marginRight: 6 }}>
                        {stock.signal && (
                          <View style={[styles.miniSignalBadge, { backgroundColor: getSignalColor(stock.signal), borderColor: getSignalTextColor(stock.signal), marginLeft: 0, marginBottom: 4 }]}>
                            <Text style={[styles.miniSignalText, { color: getSignalTextColor(stock.signal) }]}>{stock.signal}</Text>
                          </View>
                        )}
                        <View style={[styles.changeBadge, { backgroundColor: isUp ? '#064E3B' : '#7F1D1D', minWidth: 55, maxWidth: 65 }]}>
                          <Text style={[styles.changeText, { color: isUp ? '#34D399' : '#F87171', fontSize: 9, textAlign: 'center' }]} numberOfLines={1}>
                            {isUp ? '+' : ''}{stock.change_percent?.toFixed(2)}%
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteRowBtn}
                        onPress={(e) => {
                          e.stopPropagation(); // prevent opening details sheet
                          handleRemoveWatchlist(stock.ticker);
                        }}
                      >
                        <Trash2 size={12} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
                {index === 2 && <AppNativeAd isDarkMode={isDarkMode} />}
              </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* Country Selector Bottom Sheet Modal */}
      <Modal
        visible={countryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCountryModalVisible(false);
          setCountrySearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.countryModalContent, !isDarkMode && { backgroundColor: '#FFFFFF', borderTopColor: '#E2E8F0' }]}>
            {/* Modal Drag/Indicator Bar */}
            <View style={[styles.modalDragBar, !isDarkMode && { backgroundColor: '#E2E8F0' }]} />
            
            {/* Modal Header */}
            <View style={[styles.countryModalHeader, !isDarkMode && { borderBottomColor: '#E2E8F0' }]}>
              <Text style={[styles.countryModalTitle, !isDarkMode && { color: '#0F172A' }]}>Select Market / Region</Text>
              <TouchableOpacity onPress={() => {
                setCountryModalVisible(false);
                setCountrySearchQuery('');
              }}>
                <Text style={[styles.closeCountryText, !isDarkMode && { color: '#0284C7' }]}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Country Search Input */}
            <View style={[styles.countrySearchContainer, !isDarkMode && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
              <Search size={14} color="#64748B" style={styles.countrySearchIcon} />
              <TextInput
                style={[styles.countrySearchInput, !isDarkMode && { color: '#0F172A' }]}
                placeholder="Search country, code or currency..."
                placeholderTextColor="#64748B"
                value={countrySearchQuery}
                onChangeText={setCountrySearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Scrollable List of Countries */}
            <ScrollView style={styles.countryScroll}>
              {(() => {
                const filtered = Object.keys(config?.markets || {})
                  .filter((key) => {
                    const item = (config?.markets || {})[key] || {};
                    const name = (item.name || '').toLowerCase();
                    const currency = (item.currency || '').toLowerCase();
                    const code = key.toLowerCase();
                    const query = countrySearchQuery.toLowerCase().trim();
                    return name.includes(query) || currency.includes(query) || code.includes(query);
                  })
                  .sort((a, b) => {
                    const markets = config?.markets || {};
                    const nameA = (markets[a]?.name || a).toUpperCase();
                    const nameB = (markets[b]?.name || b).toUpperCase();
                    return nameA.localeCompare(nameB);
                  });

                if (filtered.length === 0) {
                  return (
                    <View style={styles.noCountryContainer}>
                      <Text style={styles.noCountryText}>No matching regions found.</Text>
                    </View>
                  );
                }

                return filtered.map((key) => {
                  const item = (config?.markets || {})[key] || {};
                  const flag = item.flag || '🌐';
                  const countryName = item.name || key;
                  const isSelected = key === market;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.countryItem, 
                        isSelected && styles.selectedCountryItem,
                        !isDarkMode && { backgroundColor: '#F1F5F9' },
                        isSelected && !isDarkMode && { backgroundColor: '#E0F2FE', borderColor: '#38BDF8' }
                      ]}
                      onPress={() => {
                        setMarket(key);
                        setSelectedTicker(null);
                        setCountryModalVisible(false);
                        setCountrySearchQuery('');
                      }}
                    >
                      <Text style={styles.countryItemFlag}>{flag}</Text>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.countryItemName, isSelected && styles.selectedCountryItemText, !isDarkMode && { color: '#0F172A' }, isSelected && !isDarkMode && { color: '#0284C7' }]}>
                          {countryName} ({key})
                        </Text>
                        <Text style={[styles.countryItemSub, !isDarkMode && { color: '#64748B' }]} numberOfLines={1}>{item.subtitle || ''}</Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedCheck}>
                          <Text style={{ color: '#00D2FF', fontWeight: 'bold', fontSize: 14 }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Detail Bottom Sheet Modal */}
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setDetailModalVisible(false);
          setActiveModalStock(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Drag/Indicator Bar */}
            <View style={styles.modalDragBar} />
            
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalStockTicker}>{(activeModalStock || selectedStockObj).ticker}</Text>
                <Text style={styles.modalStockName} numberOfLines={1}>{(activeModalStock || selectedStockObj).name}</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setDetailModalVisible(false);
                  setActiveModalStock(null);
                }}
                style={styles.closeModalBtn}
              >
                <Text style={styles.closeModalText}>✕ Close</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable details details */}
            <ScrollView style={styles.modalScrollBody} contentContainerStyle={styles.modalScrollContent}>
              {loadingAnalysis && !analysis ? (
                <View style={styles.modalLoading}>
                  <ActivityIndicator size="large" color="#00D2FF" />
                  <Text style={styles.modalLoadingText}>Calculating technical indicators...</Text>
                </View>
              ) : analysis ? (
                <View style={styles.modalInnerCard}>
                  {/* Header Info */}
                  <View style={styles.headerInfo}>
                    <View>
                      <Text style={styles.companyName}>{analysis?.profile?.name || (activeModalStock || selectedStockObj).name}</Text>
                      <Text style={styles.sectorText}>{analysis?.profile?.sector || (activeModalStock || selectedStockObj).sector}</Text>
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.mainPrice}>
                        {getCurrencySymbol(market)} {analysis.profile?.current_price?.toLocaleString() || '0.00'}
                      </Text>
                      <Text style={[styles.mainChange, { color: (analysis.profile?.change_percent ?? 0) >= 0 ? '#34D399' : '#F87171' }]}>
                        {(analysis.profile?.change_percent ?? 0) >= 0 ? '+' : ''}
                        {(analysis.profile?.change_percent ?? 0).toFixed(2)}% Today
                      </Text>
                    </View>
                  </View>

                  {/* SVG Sparkline Chart */}
                  {historical.length > 0 && (
                    <View style={styles.chartWrapper}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.chartTitle, !isDarkMode && { color: '#0F172A' }]}>Performance Trend</Text>
                          <TouchableOpacity 
                            style={[styles.chartTypeToggleBtn, !isDarkMode && { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1' }]} 
                            onPress={() => setChartType(chartType === 'line' ? 'candle' : 'line')}
                          >
                            <Text style={[styles.chartTypeToggleText, !isDarkMode && { color: '#0284C7' }]}>
                              {chartType === 'line' ? '🕯️ Candles' : '📈 Line'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={{ maxWidth: '65%', flexGrow: 0 }}
                          contentContainerStyle={[styles.timeframeRow, !isDarkMode && { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}
                        >
                          {['1D', '3D', '1W', '1M', '3M', '6M', '1Y', '3Y'].map((tf) => {
                            const labelMap = {
                              '1D': 'Today',
                              '3D': '3D',
                              '1W': '1W',
                              '1M': '1M',
                              '3M': '3M',
                              '6M': '6M',
                              '1Y': '1Y',
                              '3Y': '3Y'
                            };
                            const isActive = timeframe === tf;
                            return (
                              <TouchableOpacity
                                key={tf}
                                style={[
                                  styles.timeframeBtn, 
                                  isActive && styles.activeTimeframeBtn,
                                  isActive && !isDarkMode && { backgroundColor: '#E2E8F0' }
                                ]}
                                onPress={() => setTimeframe(tf)}
                              >
                                <Text style={[
                                  styles.timeframeBtnText, 
                                  isActive && styles.activeTimeframeBtnText,
                                  isActive && !isDarkMode && { color: '#0284C7' }
                                ]}>
                                  {labelMap[tf]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                      <View style={styles.svgContainer}>
                        {(() => {
                          const chartW = width - 48; // Padding offset
                          const chartH = 100;

                          // Find global min and max for Y-axis scaling
                          const highs = historical.map(d => d.High || d.high || d.Close || d.close || 0);
                          const lows = historical.map(d => d.Low || d.low || d.Close || d.close || 0);
                          const minPrice = Math.min(...lows);
                          const maxPrice = Math.max(...highs);
                          const midPrice = (maxPrice + minPrice) / 2;

                          const strokeColor = (analysis.profile?.change_percent ?? 0) >= 0 ? '#00D2FF' : '#F87171';
                          const axisTextColor = isDarkMode ? '#64748B' : '#94A3B8';

                          return (
                            <View>
                              <Svg width={chartW} height={chartH}>
                                {/* Grid Lines (dashed horizontal guides) */}
                                <Line x1="0" y1="5" x2={chartW} y2="5" stroke={isDarkMode ? '#1E293B' : '#E2E8F0'} strokeWidth="1" strokeDasharray="3,3" />
                                <Line x1="0" y1={chartH / 2} x2={chartW} y2={chartH / 2} stroke={isDarkMode ? '#1E293B' : '#E2E8F0'} strokeWidth="1" strokeDasharray="3,3" />
                                <Line x1="0" y1={chartH - 5} x2={chartW} y2={chartH - 5} stroke={isDarkMode ? '#1E293B' : '#E2E8F0'} strokeWidth="1" strokeDasharray="3,3" />

                                {chartType === 'candle' ? (
                                  (() => {
                                    const candles = generateCandles(historical, chartW, chartH);
                                    return (
                                      <>
                                        {candles.map((c, idx) => (
                                          <React.Fragment key={idx}>
                                            <Line 
                                              x1={c.wickX} 
                                              y1={c.yHigh} 
                                              x2={c.wickX} 
                                              y2={c.yLow} 
                                              stroke={c.color} 
                                              strokeWidth="1.2" 
                                            />
                                            <Rect 
                                              x={c.bodyX} 
                                              y={c.bodyY} 
                                              width={c.bodyW} 
                                              height={c.bodyH} 
                                              fill={c.color} 
                                              stroke={c.color}
                                              strokeWidth="0.5"
                                              rx="0.5"
                                            />
                                          </React.Fragment>
                                        ))}
                                      </>
                                    );
                                  })()
                                ) : (
                                  (() => {
                                    const { linePath, areaPath } = generateSparklinePaths(historical, chartW, chartH);
                                    const gradientStopColor = (analysis.profile?.change_percent ?? 0) >= 0 ? '#00D2FF' : '#F87171';
                                    return (
                                      <>
                                        <Defs>
                                          <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                            <Stop offset="0%" stopColor={gradientStopColor} stopOpacity="0.2" />
                                            <Stop offset="100%" stopColor={gradientStopColor} stopOpacity="0.0" />
                                          </LinearGradient>
                                        </Defs>
                                        <Path d={areaPath} fill="url(#chartGrad)" />
                                        <Path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" />
                                      </>
                                    );
                                  })()
                                )}

                                {/* Y-Axis Price Labels overlaid on the left edge */}
                                <SvgText x={4} y={14} fill={axisTextColor} fontSize="8" fontWeight="bold" textAnchor="start">
                                  {getCurrencySymbol(market)}{maxPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </SvgText>
                                <SvgText x={4} y={chartH / 2 + 3} fill={axisTextColor} fontSize="8" fontWeight="bold" textAnchor="start">
                                  {getCurrencySymbol(market)}{midPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </SvgText>
                                <SvgText x={4} y={chartH - 4} fill={axisTextColor} fontSize="8" fontWeight="bold" textAnchor="start">
                                  {getCurrencySymbol(market)}{minPrice.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                </SvgText>
                              </Svg>

                              {/* X-Axis Date Labels Row */}
                              {(() => {
                                const dStart = formatDateLabel(historical[0]?.Date || historical[0]?.date);
                                const dEnd = formatDateLabel(historical[historical.length - 1]?.Date || historical[historical.length - 1]?.date);
                                let dMid = '';
                                if (historical.length >= 3) {
                                  const midVal = formatDateLabel(historical[Math.floor(historical.length / 2)]?.Date || historical[Math.floor(historical.length / 2)]?.date);
                                  if (midVal !== dStart && midVal !== dEnd) {
                                    dMid = midVal;
                                  }
                                }
                                return (
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 4 }}>
                                    <Text style={[styles.axisText, !isDarkMode && { color: '#64748B' }]}>
                                      {dStart}
                                    </Text>
                                    {dMid ? (
                                      <Text style={[styles.axisText, !isDarkMode && { color: '#64748B' }]}>
                                        {dMid}
                                      </Text>
                                    ) : null}
                                    <Text style={[styles.axisText, !isDarkMode && { color: '#64748B' }]}>
                                      {dEnd}
                                    </Text>
                                  </View>
                                );
                              })()}
                            </View>
                          );
                        })()}
                      </View>
                    </View>
                  )}

                  {/* AI Advisory Summary */}
                  <View style={styles.aiCard}>
                    <View style={styles.aiHeader}>
                      <Award size={18} color="#00D2FF" style={{ marginRight: 6 }} />
                      <Text style={styles.aiTitle}>AI Advisory Recommendation</Text>
                    </View>
                    <View style={styles.aiBody}>
                      <View style={styles.recommendationRow}>
                        <Text style={styles.recommendationLabel}>Signal:</Text>
                        {renderRecommendationBadge(analysis.recommendation?.recommendation || 'HOLD')}
                      </View>
                      <Text style={styles.aiSummaryText}>
                        {analysis.recommendation?.summary}
                      </Text>
                    </View>
                  </View>

                  {/* Technical Readouts */}
                  <View style={styles.sectionHeader}>
                    <BarChart2 size={18} color="#00D2FF" style={{ marginRight: 6 }} />
                    <Text style={styles.sectionTitle}>Technical Indicators</Text>
                  </View>

                  <View style={styles.indicatorsCard}>
                    {/* RSI */}
                    <View style={styles.indicatorRow}>
                      <View style={styles.indicatorMeta}>
                        <Text style={styles.indicatorName}>RSI (14)</Text>
                        <Text style={[styles.indicatorVal, {
                          color: (analysis.technical_analysis?.rsi?.value ?? 50) > 70 ? '#F87171' :
                                 (analysis.technical_analysis?.rsi?.value ?? 50) < 30 ? '#34D399' : '#F3F4F6'
                        }]}>
                          {(analysis.technical_analysis?.rsi?.value ?? 0).toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.rsiTrack}>
                        <View style={[styles.rsiThumb, { left: `${analysis.technical_analysis?.rsi?.value || 50}%` }]} />
                        <View style={styles.rsiZones}>
                          <View style={styles.rsiZoneItem}><Text style={styles.rsiZoneText}>Oversold</Text></View>
                          <View style={styles.rsiZoneItem}><Text style={styles.rsiZoneText}>Neutral</Text></View>
                          <View style={styles.rsiZoneItem}><Text style={styles.rsiZoneText}>Overbought</Text></View>
                        </View>
                      </View>
                    </View>

                    {/* MACD */}
                    <View style={styles.indicatorRow}>
                      <View style={styles.indicatorMeta}>
                        <Text style={styles.indicatorName}>MACD</Text>
                        <Text style={styles.indicatorVal}>
                          {(analysis.technical_analysis?.macd?.line ?? 0).toFixed(2)}
                        </Text>
                      </View>
                      <Text style={styles.indicatorSignal}>
                        Signal Line: {(analysis.technical_analysis?.macd?.signal ?? 0).toFixed(2)} ({analysis.technical_analysis?.macd?.crossover || 'Neutral'})
                      </Text>
                    </View>

                    {/* Bollinger Bands */}
                    <View style={styles.indicatorRow}>
                      <View style={styles.indicatorMeta}>
                        <Text style={styles.indicatorName}>Bollinger Bands (20,2)</Text>
                        <Text style={styles.indicatorVal}>
                          Basis: {(analysis.technical_analysis?.bollinger_bands?.middle ?? 0).toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.bbDetails}>
                        <Text style={styles.bbDetailText}>Upper Band: <Text style={{ color: '#F87171' }}>{(analysis.technical_analysis?.bollinger_bands?.upper ?? 0).toFixed(1)}</Text></Text>
                        <Text style={styles.bbDetailText}>Lower Band: <Text style={{ color: '#34D399' }}>{(analysis.technical_analysis?.bollinger_bands?.lower ?? 0).toFixed(1)}</Text></Text>
                      </View>
                    </View>
                  </View>

                  {/* Fundamental Analysis Summary */}
                  <View style={styles.sectionHeader}>
                    <Compass size={18} color="#00D2FF" style={{ marginRight: 6 }} />
                    <Text style={styles.sectionTitle}>Fundamentals ({market === 'PK' ? 'KSE Metrics' : market + ' Metrics'})</Text>
                  </View>
                  <View style={styles.fundamentalsCard}>
                    <View style={styles.fundRow}>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>P/E Ratio</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.pe_ratio || 'N/A'}</Text>
                      </View>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>P/B Ratio</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.pb_ratio || 'N/A'}</Text>
                      </View>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>ROE</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.roe ? `${analysis.profile.roe}%` : 'N/A'}</Text>
                      </View>
                    </View>
                    <View style={styles.fundRow}>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>Div. Yield</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.div_yield ? `${analysis.profile.div_yield}%` : 'N/A'}</Text>
                      </View>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>Debt/Equity</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.debt_equity ? `${analysis.profile.debt_equity}%` : 'N/A'}</Text>
                      </View>
                      <View style={styles.fundCol}>
                        <Text style={styles.fundLabel}>Avg. Volume</Text>
                        <Text style={styles.fundVal}>{analysis.profile?.volume_avg ? analysis.profile.volume_avg.toLocaleString() : 'N/A'}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Sector Selection Modal */}
      <Modal
        visible={sectorModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSectorModalVisible(false)}
      >
        <TouchableOpacity style={styles.selectorOverlay} onPress={() => setSectorModalVisible(false)}>
          <View style={[styles.selectorCard, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.selectorTitle, !isDarkMode && { color: '#0F172A' }]}>Filter by Sector</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {sectors.map(sector => (
                <TouchableOpacity
                  key={sector}
                  style={[
                    styles.selectorItem, 
                    selectedSector === sector && styles.activeSelectorItem,
                    selectedSector === sector && !isDarkMode && { backgroundColor: '#E0F2FE' },
                    !isDarkMode && { borderBottomColor: '#E2E8F0' }
                  ]}
                  onPress={() => {
                    setSelectedSector(sector);
                    setSectorModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.selectorText, 
                    selectedSector === sector && styles.activeSelectorText,
                    selectedSector !== sector && !isDarkMode && { color: '#475569' }
                  ]}>
                    {sector === 'All' ? 'All Sectors' : sector}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort Selection Modal */}
      <Modal
        visible={sortModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity style={styles.selectorOverlay} onPress={() => setSortModalVisible(false)}>
          <View style={[styles.selectorCard, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.selectorTitle, !isDarkMode && { color: '#0F172A' }]}>Sort Stocks By</Text>
            {['Default', 'Volume', 'Gainers', 'Losers'].map(option => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.selectorItem, 
                  sortBy === option && styles.activeSelectorItem,
                  sortBy === option && !isDarkMode && { backgroundColor: '#E0F2FE' },
                  !isDarkMode && { borderBottomColor: '#E2E8F0' }
                ]}
                onPress={() => {
                  setSortBy(option);
                  setSortModalVisible(false);
                }}
              >
                <Text style={[
                  styles.selectorText, 
                  sortBy === option && styles.activeSelectorText,
                  sortBy !== option && !isDarkMode && { color: '#475569' }
                ]}>
                  {option === 'Default' ? 'Default Order' : 
                   option === 'Volume' ? 'Trading Volume 📊' :
                   option === 'Gainers' ? 'Top Gainers 📈' : 'Top Losers 📉'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  headerIndexRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  indexBannerCompact: {
    flex: 1,
  },
  countryDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dropdownBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 6,
  },
  dropdownArrow: {
    color: '#00D2FF',
    fontSize: 9,
  },
  countryModalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
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
    fontSize: 22,
  },
  countryItemName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCountryItemText: {
    color: '#38BDF8',
  },
  countryItemSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  selectedCheck: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
  marketStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  statusText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 11,
  },
  indexStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indexName: {
    color: '#F1F5F9',
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
  },
  indexVal: {
    color: '#F1F5F9',
    fontSize: 12,
    marginRight: 6,
  },
  indexChangeNegative: {
    color: '#EF4444',
    fontSize: 11,
  },
  indexChangePositive: {
    color: '#34D399',
    fontSize: 11,
  },
  indexTime: {
    color: '#64748B',
    fontSize: 10,
  },
  searchBarRow: {
    padding: 12,
    backgroundColor: '#0B0F19',
  },
  searchInput: {
    backgroundColor: '#161B26',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    color: '#F3F4F6',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  filtersRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#161B26',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  filterBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 'bold',
    maxWidth: '85%',
  },
  arrowDown: {
    color: '#64748B',
    fontSize: 9,
  },
  stocksScroll: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  stocksListContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  stockRow: {
    flexDirection: 'row',
    backgroundColor: '#161B26',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  selectedStockRow: {
    borderColor: '#00D2FF',
    backgroundColor: '#1E2538',
  },
  stockLeft: {
    flex: 2.2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  emblem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  emblemText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  nameCol: {
    flex: 1,
  },
  stockTickerText: {
    color: '#F1F5F9',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 2,
  },
  stockNameText: {
    color: '#64748B',
    fontSize: 11,
  },
  stockCenter: {
    flex: 2,
    paddingHorizontal: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gridCell: {
    flex: 1,
    alignItems: 'center',
  },
  gridLabel: {
    color: '#475569',
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  gridNum: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  stockRight: {
    flex: 1.8,
    alignItems: 'flex-end',
  },
  stockPriceText: {
    color: '#F1F5F9',
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 4,
  },
  changeBadge: {
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  changeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    borderWidth: 1,
    borderColor: '#1E293B',
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
  modalHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    alignItems: 'center',
  },
  modalStockTicker: {
    color: '#F1F5F9',
    fontWeight: 'bold',
    fontSize: 20,
  },
  modalStockName: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  closeModalBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  closeModalText: {
    color: '#E2E8F0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalScrollBody: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  modalLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  modalLoadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 13,
  },
  modalInnerCard: {
    marginTop: 16,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorCard: {
    backgroundColor: '#161B26',
    width: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  selectorTitle: {
    color: '#F1F5F9',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  selectorItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222A3C',
  },
  activeSelectorItem: {
    backgroundColor: '#1E2538',
    borderRadius: 8,
  },
  selectorText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  activeSelectorText: {
    color: '#00D2FF',
    fontWeight: 'bold',
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  companyName: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  sectorText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  mainPrice: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
  },
  mainChange: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  chartWrapper: {
    backgroundColor: '#161B26',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  chartTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  svgContainer: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiCard: {
    backgroundColor: '#161B26',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#222A3C',
    paddingBottom: 10,
    marginBottom: 12,
  },
  aiTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  aiBody: {
    gap: 8,
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationLabel: {
    color: '#94A3B8',
    fontSize: 13,
    marginRight: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  aiSummaryText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  indicatorsCard: {
    backgroundColor: '#161B26',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  indicatorRow: {
    marginBottom: 16,
  },
  indicatorMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  indicatorName: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 13,
  },
  indicatorVal: {
    fontWeight: '700',
    fontSize: 14,
  },
  rsiTrack: {
    height: 12,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    position: 'relative',
    justifyContent: 'center',
    marginTop: 4,
  },
  rsiThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#00D2FF',
    borderRadius: 7,
    marginTop: -1,
  },
  rsiZones: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  rsiZoneItem: {
    flex: 1,
    alignItems: 'center',
  },
  rsiZoneText: {
    color: '#475569',
    fontSize: 9,
    fontWeight: 'bold',
  },
  indicatorSignal: {
    color: '#94A3B8',
    fontSize: 12,
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
  },
  bbDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
  },
  bbDetailText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  fundamentalsCard: {
    backgroundColor: '#161B26',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222A3C',
  },
  fundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  fundCol: {
    flex: 1,
    alignItems: 'center',
  },
  fundLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 2,
  },
  fundVal: {
    color: '#F3F4F6',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#3F1F1F',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    margin: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#F87171',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  retryBtn: {
    backgroundColor: '#7F1D1D',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#F87171',
    fontWeight: 'bold',
    fontSize: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B26',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222A3C',
    paddingHorizontal: 12,
    height: 48,
    width: '100%',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInputField: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 14,
    height: '100%',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  searchResultsContainer: {
    position: 'absolute',
    top: 64,
    left: 12,
    right: 12,
    backgroundColor: '#0F172A',
    borderColor: '#222A3C',
    borderWidth: 1,
    borderRadius: 10,
    zIndex: 9999,
    maxHeight: 255,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  resultDetails: {
    flex: 1,
    marginRight: 10,
  },
  resultTicker: {
    color: '#00D2FF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  resultName: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  resultAction: {
    alignItems: 'flex-end',
  },
  alreadyAddedText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 3,
  },
  deleteRowBtn: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  timeframeRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  timeframeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginHorizontal: 1,
  },
  activeTimeframeBtn: {
    backgroundColor: '#1E293B',
  },
  timeframeBtnText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activeTimeframeBtnText: {
    color: '#00D2FF',
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
  listLoaderContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  listLoaderText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12,
    fontWeight: '500',
  },
  macroContainer: {
    marginVertical: 12,
    width: '100%',
  },
  macroScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  macroCard: {
    backgroundColor: '#131A2A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    width: 140,
    justifyContent: 'center',
  },
  forexCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
  },
  macroCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  macroUnitLabel: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  macroPrice: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  macroChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroChangeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  forexPair: {
    color: '#00D2FF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  forexRate: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  forexSub: {
    color: '#64748B',
    fontSize: 9,
  },
  positiveText: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  negativeText: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  axisText: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '600',
  },
  switcherAndRefreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshIconButton: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
  chartTypeToggleBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  chartTypeToggleText: {
    fontSize: 9.5,
    color: '#00D2FF',
    fontWeight: 'bold',
  },
});
