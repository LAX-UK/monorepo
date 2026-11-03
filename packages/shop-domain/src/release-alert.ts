/**
 * Release alerts: a person asks to hear when LAX Shop publishes a new edition, and lax.art
 * followers hear when an artist they follow has a new original. Consent, confirmation and the
 * daily digest are the alert engine's job; these rules say which published artworks count.
 */

/**
 * What the person is told when they ask, and what is recorded as their consent. It is the same
 * wording the alert engine stores for the LAX Shop release topic.
 */
export const RELEASE_ALERT_CONSENT_TEXT =
  "We'll email you when LAX Shop releases new editions. At most one email a day. You can stop at any time.";

/**
 * Only an edition on sale in LAX Shop is a release. Originals and works on lax.art are sold
 * elsewhere, so a subscriber to Shop editions is not told about them.
 */
export function isShopEditionRelease(artwork: {
  salesChannel: string;
  eligibleForEditionAllocation: boolean;
}): boolean {
  return artwork.salesChannel === "shop" && artwork.eligibleForEditionAllocation;
}

/**
 * An original on lax.art. Prints made from an original are editions sold in LAX Shop, so people
 * who follow the artist are told about the original, not about each print.
 */
export function isArtOriginalRelease(artwork: {
  salesChannel: string;
  sourceOriginalArtworkId: string | null;
}): boolean {
  return artwork.salesChannel === "art" && artwork.sourceOriginalArtworkId === null;
}
