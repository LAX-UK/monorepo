import type {
  ShopFeatureFlagsReader,
  ShopFeatureFlagsSnapshot,
} from "../application/ports/shop-feature-flags.js";
import type { ShopApiEnv } from "../env.js";

export function createShopFeatureFlagsReader(env: ShopApiEnv): ShopFeatureFlagsReader {
  const snapshot: ShopFeatureFlagsSnapshot = {
    payouts: env.SHOP_PAYOUTS_ENABLED,
    thirdPartySales: env.SHOP_THIRD_PARTY_ENABLED,
    originalSales: env.SHOP_ORIGINALS_ENABLED,
    merchandise: env.SHOP_MERCHANDISE_ENABLED,
  };
  return {
    read: () => snapshot,
  };
}
