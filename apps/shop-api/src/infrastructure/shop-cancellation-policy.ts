import type { CancellationPeriodPolicy } from "@auction/shop-domain";
import type { ShopApiEnv } from "../env.js";

export function loadShopCancellationPolicy(env: ShopApiEnv): CancellationPeriodPolicy | null {
  if (env.SHOP_CANCELLATION_DAYS_AFTER_POSSESSION === undefined) {
    return null;
  }
  return {
    daysAfterPossession: env.SHOP_CANCELLATION_DAYS_AFTER_POSSESSION,
    personalisedGoodsExempt: env.SHOP_PERSONALISED_GOODS_CANCELLATION_EXEMPT,
  };
}
