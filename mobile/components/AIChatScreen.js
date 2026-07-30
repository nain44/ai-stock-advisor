import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Send, Sparkles, HelpCircle } from 'lucide-react-native';

export default function AIChatScreen({ selectedTicker, portfolio, apiUrl, market = 'PK', config, aiCredits, setAiCredits, triggerRewarded, isDarkMode }) {
  const theme = {
    bg: isDarkMode ? '#0B0F19' : '#F8FAFC',
    card: isDarkMode ? '#161B26' : '#FFFFFF',
    border: isDarkMode ? '#222A3C' : '#E2E8F0',
    text: isDarkMode ? '#FFFFFF' : '#0F172A',
    subtext: isDarkMode ? '#94A3B8' : '#64748B',
    headerBg: isDarkMode ? '#0F172A' : '#FFFFFF',
    headerBorder: isDarkMode ? '#1E293B' : '#E2E8F0',
  };

  const getWelcomeText = () => {
    if (config && config.chat && config.chat.welcome_messages && config.chat.welcome_messages[market]) {
      return config.chat.welcome_messages[market];
    }
    if (market === 'PK') {
      return "As-salamu alaykum! I am your KSE AI Stock Advisor. Ask me about technical patterns, targets, or specific PSX stocks.";
    } else if (market === 'US') {
      return "Hello! I am your US Stocks AI Advisor. Ask me about technical patterns, targets, or specific NYSE/NASDAQ stocks.";
    } else if (market === 'IN') {
      return "Namaste! I am your NSE India AI Stock Advisor. Ask me about technical patterns, targets, or specific Indian stocks.";
    } else {
      return "Hello! I am your UK Stocks AI Advisor. Ask me about technical patterns, targets, or specific London Stock Exchange (LSE) stocks.";
    }
  };

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: getWelcomeText(),
      sender: 'ai',
      time: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef();

  const defaultTicker = market === 'PK' ? 'MARI' : market === 'US' ? 'AAPL' : market === 'IN' ? 'RELIANCE.NS' : 'BP.L';
  const marketLabel = market === 'PK' ? 'PSX' : market === 'US' ? 'US markets' : market === 'IN' ? 'NSE' : 'LSE';

  const suggestionChips = (config && config.chat && config.chat.suggestion_chips && config.chat.suggestion_chips[market])?.map(chip => {
    const queryTicker = selectedTicker || defaultTicker;
    const resolvedLabel = chip.label.replace('MARI', queryTicker).replace('AAPL', queryTicker).replace('RELIANCE.NS', queryTicker).replace('BP.L', queryTicker);
    const resolvedQuery = chip.query.replace('MARI', queryTicker).replace('AAPL', queryTicker).replace('RELIANCE.NS', queryTicker).replace('BP.L', queryTicker);
    return { label: resolvedLabel, query: resolvedQuery };
  }) || [
    { label: `Analyze ${selectedTicker || defaultTicker}`, query: `Can you do a full analysis of ${selectedTicker || defaultTicker} and explain target levels?` },
    { label: 'Check Portfolio Stance', query: 'Based on my simulated portfolio holdings, what changes do you recommend?' },
    { label: `Explain RSI and MACD`, query: `What are RSI and MACD, and how should I use them for trading ${marketLabel}?` },
    { label: 'Top Defensive Stocks', query: `Which stocks in the ${marketLabel} coverage are considered the best defensive/dividend stocks?` }
  ];

  const handleSend = async (queryText) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim()) return;

    if (aiCredits <= 0) {
      Alert.alert(
        "Out of AI Credits",
        "You have used all of your free AI prompts. Watch a short sponsor clip to get +3 credits!",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Watch Video Ad", onPress: triggerRewarded }
        ]
      );
      return;
    }

    setAiCredits(prev => Math.max(0, prev - 1));

    // Add user message
    const userMsg = {
      id: Math.random().toString(),
      text: textToSend,
      sender: 'user',
      time: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputText('');
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const payload = {
        query: textToSend,
        ticker: selectedTicker || defaultTicker,
        portfolio: portfolio || [],
        market: market
      };

      const res = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();

      const aiMsg = {
        id: Math.random().toString(),
        text: data.response,
        sender: 'ai',
        time: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: Math.random().toString(),
        text: "Sorry, I am unable to connect to the backend server. Please verify your connection setup.",
        sender: 'ai',
        time: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 85}
    >
      {/* Active Context Header */}
      <View style={[styles.contextHeader, { justifyContent: 'flex-end', backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.contextText, { marginRight: 8, color: theme.text }]}>
            AI Credits: <Text style={{ color: aiCredits > 0 ? '#34D399' : '#F87171', fontWeight: 'bold' }}>{aiCredits}</Text>
          </Text>
          {aiCredits === 0 && (
            <TouchableOpacity 
              style={styles.adRefillBtn} 
              onPress={triggerRewarded}
              activeOpacity={0.7}
            >
              <Text style={styles.adRefillText}>+ Refill</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => {
          const isAI = msg.sender === 'ai';
          return (
            <View key={msg.id} style={[styles.messageRow, isAI ? styles.aiRow : styles.userRow]}>
              <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
                <Text style={[styles.bubbleText, isAI ? styles.aiText : styles.userText]}>
                  {msg.text}
                </Text>
              </View>
              <Text style={styles.timeText}>
                {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        })}
        {loading && (
          <View style={[styles.messageRow, styles.aiRow]}>
            <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
              <ActivityIndicator size="small" color="#00D2FF" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Floating Suggestion Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {suggestionChips.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.chip}
              onPress={() => handleSend(chip.query)}
              disabled={loading}
            >
              <HelpCircle size={12} color="#00D2FF" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={`Ask AI Advisor about ${marketLabel} stocks...`}
          placeholderTextColor="#64748B"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={() => handleSend()}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={loading || !inputText.trim()}
        >
          <Send size={18} color="#0B0F19" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  contextHeader: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  adRefillBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adRefillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  contextText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  boldText: {
    color: '#00D2FF',
    fontWeight: '700',
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageRow: {
    marginBottom: 16,
    maxWidth: '85%',
  },
  aiRow: {
    alignSelf: 'flex-start',
  },
  userRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  aiBubble: {
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222A3C',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#00D2FF',
    borderTopRightRadius: 4,
  },
  loadingBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  aiText: {
    color: '#E2E8F0',
  },
  userText: {
    color: '#0B0F19',
    fontWeight: '500',
  },
  timeText: {
    color: '#475569',
    fontSize: 9,
    marginTop: 4,
    marginHorizontal: 4,
  },
  chipsWrapper: {
    backgroundColor: '#0F172A30',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  chipsScroll: {
    paddingHorizontal: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipText: {
    color: '#E2E8F0',
    fontSize: 12,
  },
  inputBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 8,
    color: '#F3F4F6',
    fontSize: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00D2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1E293B',
  },
});
