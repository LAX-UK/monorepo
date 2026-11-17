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
