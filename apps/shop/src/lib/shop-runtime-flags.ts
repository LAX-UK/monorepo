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
