export function isArtPayoutsEnabled(): boolean {
  return process.env.SHOP_PAYOUTS_ENABLED === "true";
}

export function isArtEditorialEnabled(): boolean {
  return process.env.ART_EDITORIAL_ENABLED === "true";
}
