import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getFallbackNews, resolveNewsItems } from './newsFallback';

const NewsScreen = ({ apiUrl, market, refreshTrigger, isDarkMode }) => {
  const [news, setNews] = useState(() => getFallbackNews('PK'));
  const [loadingNews, setLoadingNews] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchNews = async () => {
      const fallbackNews = getFallbackNews(market);

      try {
        setLoadingNews(true);
        setNews(fallbackNews);

        const res = await fetch(`${apiUrl}/api/news?market=${market}`);
        let payload = null;

        if (res.ok) {
          const text = await res.text();
          if (text) {
            try {
              payload = JSON.parse(text);
            } catch (parseErr) {
              payload = null;
            }
          }
        }

        if (!ignore) {
          const resolved = resolveNewsItems(payload, market);
          setNews(Array.isArray(resolved) && resolved.length > 0 ? resolved : fallbackNews);
        }
      } catch (err) {
        console.warn('Failed to retrieve market news data', err);
        if (!ignore) {
          setNews(fallbackNews);
        }
      } finally {
        if (!ignore) {
          setLoadingNews(false);
        }
      }
    };

    fetchNews();
    return () => {
      ignore = true;
    };
  }, [apiUrl, market, refreshTrigger]);

  const renderNewsCard = (item, idx) => {
    const sentiment = (item.sentiment || 'neutral').toLowerCase();
    const isBullish = sentiment === 'bullish';
    const isBearish = sentiment === 'bearish';
    const sentimentColor = isBullish ? '#10B981' : isBearish ? '#EF4444' : '#64748B';
    const sentimentBg = isBullish
      ? 'rgba(16, 185, 129, 0.12)'
      : isBearish
        ? 'rgba(239, 68, 68, 0.12)'
        : 'rgba(100, 116, 139, 0.12)';

    return (
      <TouchableOpacity
        key={`news-card-${idx}`}
        style={[styles.card, !isDarkMode && { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
        onPress={() => {
          if (item.link && item.link !== '#') {
            Linking.openURL(item.link).catch((err) => console.error("Couldn't open link", err));
          }
        }}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.sourceBadge, !isDarkMode && { backgroundColor: '#F1F5F9' }]}> 
            <Text style={[styles.sourceText, !isDarkMode && { color: '#475569' }]} numberOfLines={1}>
              {item.source || 'Market Feed'}
            </Text>
          </View>
          <View style={[styles.sentimentBadge, { backgroundColor: sentimentBg, borderColor: sentimentColor }]}> 
            <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
            <Text style={[styles.sentimentText, { color: sentimentColor }]}> 
              {sentiment.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, !isDarkMode && { color: '#0F172A' }]} numberOfLines={4}>
          {item.title || 'No title available'}
        </Text>

        <Text style={styles.pubDate}>
          {item.pub_date ? item.pub_date.split(' ').slice(0, 4).join(' ') : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#F8FAFC' }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBlock}>
        <Text style={[styles.pageTitle, { color: isDarkMode ? '#FFFFFF' : '#0F172A' }]}>Market News</Text>
        <Text style={[styles.pageSubtitle, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>Live updates from the selected market and sentiment feed.</Text>
      </View>

      {loadingNews && news.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#00D2FF" />
        </View>
      ) : news.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={[styles.emptyText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>No news articles are available right now.</Text>
        </View>
      ) : (
        <View style={styles.list}> {news.map((item, idx) => renderNewsCard(item, idx))} </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerBlock: {
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
  },
  loadingBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  list: {
    gap: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sourceBadge: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  sentimentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sentimentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  sentimentText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
    lineHeight: 21,
  },
  pubDate: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
  },
});

export default NewsScreen;
