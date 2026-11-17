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
 * off, those pages keep their usual headers and never load Stripe.js. The value is validated by
 * `loadShopEnv`, which the middleware runs on every page request.
 */
export function isShopExpressCheckoutEnabled(): boolean {
  return process.env.SHOP_EXPRESS_CHECKOUT === "true";
}
