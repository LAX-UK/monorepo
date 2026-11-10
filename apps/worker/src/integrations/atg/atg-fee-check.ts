import type { AtgRemoteAuctionFees } from "./atg-gateway.js";
import type { GapAuctionFields } from "./gap-types.js";

/** Starts every stored fee-mismatch message, so a later tick can tell one is still showing. */
export const FEE_MISMATCH_PREFIX = "ATG holds different fees from LAX: ";

/** GAP stores fees as doubles; anything closer than this is the same number. */
export const FEE_TOLERANCE = 1e-6;

type FeeField = {
  label: string;
  sent: (fields: GapAuctionFields) => number | undefined;
  held: (fees: AtgRemoteAuctionFees) => number | null;
};

const FEE_FIELDS: readonly FeeField[] = [
  { label: "Buyer's premium", sent: (f) => f.BuyersPremium, held: (r) => r.buyersPremium },
  {
    label: "Buyer's premium VAT",
    sent: (f) => f.BuyersPremiumVatRate,
    held: (r) => r.buyersPremiumVatRate,
  },
  {
    label: "Internet surcharge",
    sent: (f) => f.InternetSurchargeRate,
    held: (r) => r.internetSurchargeRate,
  },
  {
    label: "Internet surcharge VAT",
    sent: (f) => f.InternetSurchargeVatRate,
    held: (r) => r.internetSurchargeVatRate,
  },
];

/**
 * Compares the fees LAX sent with the ones ATG holds after the write. Returns a staff message
 * naming each difference, or null when they agree. A field LAX did not send, or ATG did not
 * return, proves nothing and is skipped.
 */
export function describeFeeMismatch(
  sent: GapAuctionFields,
  held: AtgRemoteAuctionFees,
): string | null {
  const differences = FEE_FIELDS.flatMap(({ label, sent: sentValue, held: heldValue }) => {
    const ours = sentValue(sent);
    const theirs = heldValue(held);
    if (ours === undefined || theirs === null) return [];
    return Math.abs(ours - theirs) <= FEE_TOLERANCE
      ? []
      : [`${label} LAX sent ${ours}, ATG has ${theirs}`];
  });
  return differences.length > 0 ? `${FEE_MISMATCH_PREFIX}${differences.join("; ")}.` : null;
}
