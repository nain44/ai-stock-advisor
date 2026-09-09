import { Platform } from 'react-native';

// Entitlement identifier configured in the RevenueCat dashboard — must match
// exactly what's set up there.
export const AD_FREE_ENTITLEMENT_ID = 'ad_free';

// Fill these in once a RevenueCat project exists (Project Settings > API Keys).
// Public SDK keys are safe to ship in client code.
const REVENUECAT_API_KEYS = {
  ios: '',
  android: '',
};

// Check if react-native-purchases' native module is available. Like AdManager's
// AdMob check, this fails gracefully (e.g. under Expo Go, which can't load
// custom native modules) instead of crashing the app.
let PurchasesSDK = null;
try {
  PurchasesSDK = require('react-native-purchases').default;
} catch (e) {
  // Native module not available (Expo Go / web) — purchases stay disabled.
}

export const hasNativeIAP = !!(PurchasesSDK && Platform.OS !== 'web');

let isConfigured = false;

function currentApiKey() {
  return Platform.OS === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
}

// True once both the native module is present AND a real API key has been
// filled in above — lets the UI show a clear "not set up yet" state instead
// of a confusing purchase failure.
export function isPurchasesReady() {
  return hasNativeIAP && !!currentApiKey();
}

export function configurePurchases() {
  if (isConfigured || !isPurchasesReady()) return;
  try {
    PurchasesSDK.configure({ apiKey: currentApiKey() });
    isConfigured = true;
  } catch (e) {
    console.warn('Failed to configure RevenueCat', e);
  }
}

function hasAdFreeEntitlement(customerInfo) {
  return !!(customerInfo && customerInfo.entitlements && customerInfo.entitlements.active && customerInfo.entitlements.active[AD_FREE_ENTITLEMENT_ID]);
}

// Returns the purchasable "remove ads" package (price, product id, etc.) from
// the RevenueCat current offering, or null if unavailable.
export async function fetchAdFreePackage() {
  if (!isConfigured) return null;
  try {
    const offerings = await PurchasesSDK.getOfferings();
    const pkgs = offerings?.current?.availablePackages || [];
    return pkgs[0] || null;
  } catch (e) {
    console.warn('Failed to fetch RevenueCat offerings', e);
    return null;
  }
}

export async function purchaseAdFree(pkg) {
  if (!isConfigured) throw new Error('Purchases are not configured in this build.');
  const { customerInfo } = await PurchasesSDK.purchasePackage(pkg);
  return hasAdFreeEntitlement(customerInfo);
}

export async function restorePurchases() {
  if (!isConfigured) throw new Error('Purchases are not configured in this build.');
  const customerInfo = await PurchasesSDK.restorePurchases();
  return hasAdFreeEntitlement(customerInfo);
}

export async function checkAdFreeEntitlement() {
  if (!isConfigured) return false;
  try {
    const customerInfo = await PurchasesSDK.getCustomerInfo();
    return hasAdFreeEntitlement(customerInfo);
  } catch (e) {
    return false;
  }
}
