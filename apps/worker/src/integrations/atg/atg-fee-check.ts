import type { AtgRemoteAuctionFees } from "./atg-gateway.js";
import type { GapAuctionFields } from "./gap-types.js";

/** Starts every stored fee-mismatch message, so a later tick can tell one is still showing. */
export const FEE_MISMATCH_PREFIX = "ATG holds different fees from LAX: ";

/** GAP stores fees as doubles; anything closer than this is the same number. */
export const FEE_TOLERANCE = 1e-6;

/** GAP takes fee rates as percentages (25 = 25%) but VAT rates as multipliers (0.2 = 20%). */
type FeeUnit = "percent" | "multiplier";

type FeeField = {
  label: string;
  unit: FeeUnit;
  sent: (fields: GapAuctionFields) => number | undefined;
  held: (fees: AtgRemoteAuctionFees) => number | null;
};

const FEE_FIELDS: readonly FeeField[] = [
  {
    label: "Buyer's premium",
    unit: "percent",
    sent: (f) => f.BuyersPremium,
    held: (r) => r.buyersPremium,
  },
  {
    label: "Buyer's premium VAT",
    unit: "multiplier",
    sent: (f) => f.BuyersPremiumVatRate,
    held: (r) => r.buyersPremiumVatRate,
  },
  {
    label: "Internet surcharge",
    unit: "percent",
    sent: (f) => f.InternetSurchargeRate,
    held: (r) => r.internetSurchargeRate,
  },
  {
    label: "Internet surcharge VAT",
    unit: "multiplier",
    sent: (f) => f.InternetSurchargeVatRate,
    held: (r) => r.internetSurchargeVatRate,
  },
];

function trimmed(value: number): string {
  return String(Number(value.toFixed(6)));
}

/** A percentage staff can read, with GAP's raw value in brackets where it is not the same. */
function readable(value: number, unit: FeeUnit): string {
  return unit === "percent" ? `${trimmed(value)}%` : `${trimmed(value * 100)}% (${trimmed(value)})`;
}

/**
 * Compares the fees LAX sent with the ones ATG holds after the write. Returns a staff message
 * naming each difference, or null when they agree. A field LAX did not send, or ATG did not
 * return, proves nothing and is skipped.
 */
export function describeFeeMismatch(
  sent: GapAuctionFields,
  held: AtgRemoteAuctionFees,
): string | null {
  const differences = FEE_FIELDS.flatMap(({ label, unit, sent: sentValue, held: heldValue }) => {
    const ours = sentValue(sent);
    const theirs = heldValue(held);
    if (ours === undefined || theirs === null) return [];
    if (Math.abs(ours - theirs) <= FEE_TOLERANCE) return [];
    return [`${label}: LAX sent ${readable(ours, unit)}, ATG has ${readable(theirs, unit)}`];
  });
  return differences.length > 0 ? `${FEE_MISMATCH_PREFIX}${differences.join("; ")}.` : null;
}

/** The message ends at the first full stop followed by a space or the end of the text. */
const FEE_SEGMENT = new RegExp(`^${FEE_MISMATCH_PREFIX}.*?\\.(?: |$)`);

/** The fee-mismatch message at the start of a stored `lastError`, or null. */
export function feeMismatchSegment(lastError: string | null | undefined): string | null {
  const match = lastError ? FEE_SEGMENT.exec(lastError) : null;
  return match ? match[0].trim() : null;
}

/** `lastError` without its fee-mismatch message. */
export function withoutFeeMismatch(lastError: string | null | undefined): string | null {
  const segment = feeMismatchSegment(lastError);
  const rest = segment ? (lastError ?? "").slice(segment.length).trim() : (lastError ?? "");
  return rest || null;
}

export function joinMessages(...messages: Array<string | null>): string | null {
  const present = messages.filter((message): message is string => Boolean(message));
  return present.length > 0 ? present.join(" ") : null;
}

/**
 * A new error text that keeps the fee-mismatch message already showing, so another write to
 * `lastError` cannot hide fees ATG still holds wrongly. Pass null to keep only the mismatch.
 */
export function withFeeMismatch(
  existingLastError: string | null | undefined,
  nextError: string | null,
): string | null {
  return joinMessages(feeMismatchSegment(existingLastError), nextError);
}
