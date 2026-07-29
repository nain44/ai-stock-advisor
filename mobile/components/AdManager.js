import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ActivityIndicator, Platform } from 'react-native';
import { X } from 'lucide-react-native';

// Toggle to force test ad unit IDs during development/testing
const USE_TEST_ADS = true; 

// Standard Google test IDs to fall back on when in development or testing
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

// AdMob Unit IDs
export const AD_UNITS = {
  banner: USE_TEST_ADS ? TEST_BANNER_ID : 'ca-app-pub-4935488254463353/4624173658',
  interstitial: USE_TEST_ADS ? TEST_INTERSTITIAL_ID : 'ca-app-pub-4935488254463353/6212587499',
  native: 'ca-app-pub-4935488254463353/8742693706',
  reward: USE_TEST_ADS ? TEST_REWARDED_ID : 'ca-app-pub-4935488254463353/8742693706',
};

// Check if react-native-google-mobile-ads native module is available
let gma = null;
let BannerAdComponent = null;
let BannerAdSize = null;

try {
  gma = require('react-native-google-mobile-ads');
  BannerAdComponent = gma.BannerAd;
  BannerAdSize = gma.BannerAdSize;
} catch (e) {
  // Offline/Dev fallback mode
}

// Check if running in a real environment with native AdMob capabilities compiled
const hasNativeAdMob = !!(gma && BannerAdComponent && Platform.OS !== 'web');

// 1. Banner Ad Component
export const AppBannerAd = () => {
  if (hasNativeAdMob) {
    try {
      return (
        <View style={styles.bannerContainer}>
          <BannerAdComponent
            unitId={AD_UNITS.banner}
            size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdFailedToLoad={(error) => console.warn('Banner Ad failed to load', error)}
          />
        </View>
      );
    } catch (err) {
      console.warn("Failed rendering real BannerAd, rendering mock fallback", err);
    }
  }

  // Beautiful mock fallback
  return (
    <View style={styles.mockBanner}>
      <Text style={styles.mockAdBadge}>SPONSORED</Text>
      <Text style={styles.mockBannerText}>Trade Commodities & Stocks with 0% commission. Open MultiInvest Pro Account!</Text>
    </View>
  );
};

// 2. Native Advanced Ad Component (Inline inside list)
export const AppNativeAd = () => {
  return (
    <View style={styles.mockNativeCard}>
      <View style={styles.nativeCardHeader}>
        <View style={styles.nativeAdBadgeContainer}>
          <Text style={styles.nativeAdBadgeText}>SPONSORED</Text>
        </View>
        <Text style={styles.nativeCardTitle}>MultiStocks AI Pro</Text>
      </View>
      <Text style={styles.nativeCardDescription}>
        Unlock unlimited AI market prompts, multi-country portfolio analytics, and automated push alerts for KSE and NYSE.
      </Text>
      <TouchableOpacity style={styles.nativeCardBtn} activeOpacity={0.8}>
        <Text style={styles.nativeCardBtnText}>Learn More</Text>
      </TouchableOpacity>
    </View>
  );
};

// 3. Mock Interstitial Ad Modal (Root Overlay)
export const MockInterstitialModal = ({ visible, onClose }) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.interstitialBox}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
          <Text style={styles.interstitialBadge}>SPONSORED INTERSTITIAL</Text>
          <Text style={styles.interstitialTitle}>MultiInvest Brokerage</Text>
          <Text style={styles.interstitialDesc}>
            Join over 1,000,000+ investors globally. Trade gold, silver, PKR/USD forex index pairs, and regional stocks. 
            Leverage 1:500 margin options and instant automated withdrawals.
          </Text>
          <TouchableOpacity style={styles.interstitialAction} onPress={onClose}>
            <Text style={styles.interstitialActionText}>Open Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// 4. Mock Rewarded Ad Modal (Root Overlay with Countdown)
export const MockRewardedModal = ({ visible, onClose, onRewardEarned }) => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (!visible) return;
    setCountdown(3);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onRewardEarned();
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.rewardedBox}>
          <Text style={styles.rewardedBadge}>SPONSORED VIDEO AD</Text>
          <ActivityIndicator size="large" color="#00D2FF" style={{ marginVertical: 20 }} />
          <Text style={styles.rewardedTitle}>Watching Sponsor Promo...</Text>
          <Text style={styles.rewardedTimer}>Reward in: {countdown}s</Text>
          <Text style={styles.rewardedInfo}>Do not close. Complete viewing to earn +5 AI Chat credits.</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 4,
  },
  mockBanner: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  mockAdBadge: {
    backgroundColor: '#38BDF8',
    color: '#0B0F19',
    fontSize: 9,
    fontWeight: 'bold',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginRight: 8,
  },
  mockBannerText: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
  },
  mockNativeCard: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  nativeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nativeAdBadgeContainer: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  nativeAdBadgeText: {
    color: '#3B82F6',
    fontSize: 9,
    fontWeight: 'bold',
  },
  nativeCardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  nativeCardDescription: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  nativeCardBtn: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  nativeCardBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 12, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  interstitialBox: {
    width: '85%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  interstitialBadge: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  interstitialTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  interstitialDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  interstitialAction: {
    backgroundColor: '#00D2FF',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  interstitialActionText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rewardedBox: {
    width: '80%',
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#312E81',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  rewardedBadge: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  rewardedTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  rewardedTimer: {
    color: '#F59E0B',
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  rewardedInfo: {
    color: '#6366F1',
    fontSize: 11,
    textAlign: 'center',
  }
});
