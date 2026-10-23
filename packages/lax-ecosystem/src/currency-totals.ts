export type CurrencyTotal = { currency: string; amount: number };

/**
 * Sums amounts per currency. Currencies are never converted or combined: the result has one
 * entry per currency, sorted by code so output is stable.
 */
export function sumByCurrency(
  amounts: Iterable<{ currency: string; amount: number }>,
): CurrencyTotal[] {
  const totals = new Map<string, number>();
  for (const { currency, amount } of amounts) {
    totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
