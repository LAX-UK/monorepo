export function isArtPayoutsEnabled(): boolean {
  return process.env.SHOP_PAYOUTS_ENABLED === "true";
}
