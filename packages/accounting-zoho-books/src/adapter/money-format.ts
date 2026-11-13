import type { Pence } from "@auction/accounting-domain";

/** Pence as the two-decimal pounds Books expects. `p / 100` is the nearest double to the exact value. */
export function penceToPounds(pence: Pence): number {
  return pence / 100;
}

/**
 * A pounds value read from Books back to whole pence, or null when it is not an amount of whole
 * pence (not a number, not finite, or a fraction of a penny). Never rounds a fraction away.
 */
export function poundsToPence(value: unknown): Pence | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const scaled = value * 100;
  const pence = Math.round(scaled);
  if (Math.abs(scaled - pence) > 1e-6 || !Number.isSafeInteger(pence)) return null;
  return pence;
}
