/**
 * Rendered heights of each product's header lockup, in CSS pixels. Headers size the lockup by
 * height and let the width follow the artwork, so the four read at one visual weight.
 */
export const LOCKUP_HEIGHTS = {
  /** The LAX mark on its own, in the desktop header. */
  desktopMark: 38,
  /** LAX Bid's lockup (mark, ".BID" and tagline). */
  desktopBid: 40,
  /** LAX Shop's lockup (the Exchange wordmark with ".SHOP"). */
  desktopShop: 50,
  /** The lax.art wordmark. */
  desktopArt: 40,
  /** The mark under 768px, always followed by the product tag. */
  phoneMark: 28,
} as const;

export type LockupHeightKey = keyof typeof LOCKUP_HEIGHTS;

/** The product tag set beside the phone mark. */
export const PHONE_LOCKUP_TAGS = {
  bid: ".BID",
  shop: ".SHOP",
  art: ".ART",
} as const;

export type PhoneLockupProduct = keyof typeof PHONE_LOCKUP_TAGS;

/** Desktop lockup height for a product, in pixels. */
export function desktopLockupHeight(product: PhoneLockupProduct): number {
  if (product === "bid") return LOCKUP_HEIGHTS.desktopBid;
  if (product === "shop") return LOCKUP_HEIGHTS.desktopShop;
  return LOCKUP_HEIGHTS.desktopArt;
}
