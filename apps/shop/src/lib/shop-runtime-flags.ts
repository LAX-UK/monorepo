import { loadShopEnv } from "@/env";

export function isShopMerchandiseEnabled(): boolean {
  return process.env.SHOP_MERCHANDISE_ENABLED === "true";
}

/**
 * Framing on editions and in the basket. Off until orders price framing; mirrors shop-api's own
 * SHOP_FRAMING_ENABLED, which is what actually refuses framing.
 */
export function isShopFramingEnabled(): boolean {
  return process.env.SHOP_FRAMING_ENABLED === "true";
}

/**
 * GAP-49 express checkout: Stripe's wallet row on the basket and Details. Off by default; while
 * off, those pages keep their usual headers and never load Stripe.js. Reads the value `loadShopEnv`
 * validates (the same one the middleware uses), so an invalid value throws rather than guessing.
 */
export function isShopExpressCheckoutEnabled(): boolean {
  return loadShopEnv().SHOP_EXPRESS_CHECKOUT;
}

/** A Stripe publishable key as Stripe issues it; anything else leaves the wallet row off. */
const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9]+$/;

/**
 * The publishable key for the wallet row, or null when express checkout is off or no valid key is
 * set. Pages show the row only when this is a key.
 */
export function shopExpressCheckoutPublishableKey(): string | null {
  const env = loadShopEnv();
  if (!env.SHOP_EXPRESS_CHECKOUT) return null;
  const key = env.SHOP_STRIPE_PUBLISHABLE_KEY;
  return key && PUBLISHABLE_KEY_PATTERN.test(key) ? key : null;
}
