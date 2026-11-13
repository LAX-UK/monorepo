/**
 * The buyer's premium line as a person reads it: the name on the first line and how it was worked
 * out on a quieter second one. The invoice stores one label, "Buyer's premium (15% of £500,000 +
 * 10% of £100,000)"; Pay and the purchase page both split it here, so they read the same.
 */
export type PremiumLineParts = {
  /** "Buyer's premium". */
  label: string;
  /** "15% of £500,000 + 10% of £100,000", or "25%"; `null` when the label has no breakdown. */
  detail: string | null;
};

const WITH_DETAIL = /^(.+?)\s*\((.+)\)$/;

export function premiumLineParts(stored: string): PremiumLineParts {
  const match = WITH_DETAIL.exec(stored.trim());
  if (!match?.[1] || !match[2]) return { label: stored.trim(), detail: null };
  return { label: match[1], detail: match[2] };
}
