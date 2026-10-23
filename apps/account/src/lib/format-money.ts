const LOCALE = "en-GB";

function fractionDigits(currency: string): number {
  const resolved = new Intl.NumberFormat(LOCALE, { style: "currency", currency }).resolvedOptions();
  return resolved.maximumFractionDigits ?? 2;
}

/**
 * Formats integer minor units (pence, cents) in their own currency. The currency is never
 * converted, and an unrecognised code is shown beside the plain figure rather than hidden.
 */
export function formatMinorUnits(amount: number, currency: string): string {
  try {
    const digits = fractionDigits(currency);
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(
      amount / 10 ** digits,
    );
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

/** Joins per-currency amounts side by side, for example "£12,400.00 · €3,100.00". */
export function formatCurrencyTotals(
  totals: readonly { currency: string; amount: number }[],
): string {
  return totals.map((total) => formatMinorUnits(total.amount, total.currency)).join(" · ");
}

/** A calendar date in British format, read in UTC so server and browser agree. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}
