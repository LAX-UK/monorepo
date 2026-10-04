import type { VatPolicy } from "@auction/shop-domain";
import type { ShopApiEnv } from "../env.js";

export function loadShopVatPolicy(env: ShopApiEnv): VatPolicy | null {
  if (env.SHOP_VAT_STANDARD_RATE_BP === undefined) {
    return null;
  }
  return { standardRateBp: env.SHOP_VAT_STANDARD_RATE_BP };
}

/** Fail closed when payouts are enabled but VAT is not configured. */
export function assertShopVatPolicyWhenPayoutsEnabled(env: ShopApiEnv): void {
  if (env.SHOP_PAYOUTS_ENABLED && loadShopVatPolicy(env) === null) {
    throw new Error(
      "SHOP_PAYOUTS_ENABLED requires SHOP_VAT_STANDARD_RATE_BP to be set (VAT policy)",
    );
  }
}
