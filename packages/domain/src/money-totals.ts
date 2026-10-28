import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "./money-compare.js";

/** An amount in one currency (decimal string in major units, e.g. "1250.00"). */
export type MoneyTotal = { currency: string; amount: string };

/** An estimate range in one currency. */
export type EstimateTotal = { currency: string; low: string; high: string };

const DEFAULT_CURRENCY = "GBP";

/** Pounds first (the platform's currency), then the others by code, so output is stable. */
function byPlatformCurrencyFirst(a: { currency: string }, b: { currency: string }): number {
  if (a.currency === b.currency) return 0;
  if (a.currency === DEFAULT_CURRENCY) return -1;
  if (b.currency === DEFAULT_CURRENCY) return 1;
  return a.currency.localeCompare(b.currency);
}

function currencyCode(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_CURRENCY;
}

function byCurrency<T extends { currency: string }>(rows: Iterable<T>, reduce: (a: T, b: T) => T) {
  const totals = new Map<string, T>();
  for (const row of rows) {
    const keyed = { ...row, currency: currencyCode(row.currency) };
    const current = totals.get(keyed.currency);
    totals.set(keyed.currency, current ? reduce(current, keyed) : keyed);
  }
  return [...totals.values()].sort(byPlatformCurrencyFirst);
}

const add = (a: string, b: string) =>
  minorUnitsToMoneyString(parseMoneyToMinorUnits(a) + parseMoneyToMinorUnits(b));

/**
 * Totals per currency, pounds first. Currencies are never converted or combined, so a figure
 * never mixes them; zero totals are dropped so "nothing" reads as nothing, not "£0.00".
 */
export function sumMoneyByCurrency(rows: Iterable<MoneyTotal>): MoneyTotal[] {
  return byCurrency(
    [...rows].map((row) => ({ currency: row.currency, amount: add("0", row.amount) })),
    (a, b) => ({ currency: a.currency, amount: add(a.amount, b.amount) }),
  ).filter((total) => parseMoneyToMinorUnits(total.amount) !== 0n);
}

/** Estimate ranges per currency, pounds first. */
export function sumEstimatesByCurrency(rows: Iterable<EstimateTotal>): EstimateTotal[] {
  return byCurrency(
    [...rows].map((row) => ({
      currency: row.currency,
      low: add("0", row.low),
      high: add("0", row.high),
    })),
    (a, b) => ({ currency: a.currency, low: add(a.low, b.low), high: add(a.high, b.high) }),
  );
}
