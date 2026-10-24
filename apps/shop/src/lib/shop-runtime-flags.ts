export function isShopMerchandiseEnabled(): boolean {
  return process.env.SHOP_MERCHANDISE_ENABLED === "true";
}
