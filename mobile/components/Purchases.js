import { Platform } from 'react-native';

// Product id configured in App Store Connect / Google Play Console — must
// match exactly what's set up there. Single non-consumable "remove ads" IAP.
export const PRO_UNLOCK_PRODUCT_ID = 'pro_unlock';

// Check if react-native-iap's native module is available. Like AdManager's
// AdMob check, this fails gracefully (e.g. under Expo Go, which can't load
// custom native modules) instead of crashing the app.
let IAP = null;
try {
  IAP = require('react-native-iap');
} catch (e) {
  // Native module not available (Expo Go / web) — purchases stay disabled.
}

export const hasNativeIAP = !!(IAP && Platform.OS !== 'web' && IAP.isNitroReady && IAP.isNitroReady());

let isConnected = false;
let purchaseUpdateSub = null;
let purchaseErrorSub = null;

export function isPurchasesReady() {
  return hasNativeIAP;
}

export async function configurePurchases() {
  if (isConnected || !isPurchasesReady()) return;
  try {
    await IAP.initConnection();
    isConnected = true;

    // Finish any purchase as soon as it comes back, whether it started in
    // this session (purchaseAdFree) or was restored by the store itself.
    purchaseUpdateSub = IAP.purchaseUpdatedListener(async (purchase) => {
      try {
        await IAP.finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        // ignore — already finished or transient store error
      }
    });
    purchaseErrorSub = IAP.purchaseErrorListener(() => {});
  } catch (e) {
    console.warn('Failed to connect to the store', e);
  }
}

function hasProUnlock(purchases) {
  return !!(purchases || []).find((p) => p.productId === PRO_UNLOCK_PRODUCT_ID);
}

// Returns the purchasable "remove ads" product (price, product id, etc.), or
// null if unavailable.
export async function fetchAdFreePackage() {
  if (!isConnected) return null;
  try {
    const products = await IAP.fetchProducts({ skus: [PRO_UNLOCK_PRODUCT_ID], type: 'in-app' });
    return products?.[0] || null;
  } catch (e) {
    console.warn('Failed to fetch IAP products', e);
    return null;
  }
}

export async function purchaseAdFree() {
  if (!isConnected) throw new Error('Purchases are not configured in this build.');
  await IAP.requestPurchase({
    request: {
      apple: { sku: PRO_UNLOCK_PRODUCT_ID },
      google: { skus: [PRO_UNLOCK_PRODUCT_ID] },
    },
    type: 'in-app',
  });
  const purchases = await IAP.getAvailablePurchases();
  return hasProUnlock(purchases);
}

export async function restorePurchases() {
  if (!isConnected) throw new Error('Purchases are not configured in this build.');
  const purchases = await IAP.getAvailablePurchases();
  return hasProUnlock(purchases);
}

export async function checkAdFreeEntitlement() {
  if (!isConnected) return false;
  try {
    const purchases = await IAP.getAvailablePurchases();
    return hasProUnlock(purchases);
  } catch (e) {
    return false;
  }
}
