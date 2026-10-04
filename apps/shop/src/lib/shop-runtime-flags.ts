export function isShopMerchandiseEnabled(): boolean {
  return process.env.SHOP_MERCHANDISE_ENABLED === "true";
}

export function isShopPayoutsEnabled(): boolean {
  return process.env.SHOP_PAYOUTS_ENABLED === "true";
}
