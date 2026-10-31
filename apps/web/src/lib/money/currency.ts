import { formatMoney } from "@/lib/ui/format";
import type { LotMarketingDetails } from "@auction/types";

/** Platform settlement and payment currency (matches API env defaults). */
export const PLATFORM_DEFAULT_CURRENCY = "GBP";

const ISO_CURRENCY = /^[A-Z]{3}$/;

export function normalizeCurrencyCode(raw: string | null | undefined): string {
  const code = raw?.trim().toUpperCase();
  if (code && ISO_CURRENCY.test(code)) return code;
  return PLATFORM_DEFAULT_CURRENCY;
}

type LotCurrencySource = {
  marketingDetails?: LotMarketingDetails | null;
};

/**
 * The currency a lot is bid and paid in: current bid, maximums, the bid button, hammer, buyer's
 * premium, totals and checkout. Bids are taken and payments charged in the platform currency
 * (GBP), whatever currency the catalogue gives its estimate in; only the estimate keeps its own
 * currency, through {@link formatEstimateRange}. The lot is taken so a per-sale currency can be
 * introduced here, in one place.
 */
export function lotChargeCurrency(_lot: LotCurrencySource): string {
  return PLATFORM_DEFAULT_CURRENCY;
}

export function formatEstimateRange(input: {
  low: string;
  high: string;
  currency: string;
}): string {
  const currency = normalizeCurrencyCode(input.currency);
  return `${formatMoney(input.low, currency)} – ${formatMoney(input.high, currency)}`;
}

function toAmount(amount: string | number): number {
  return typeof amount === "string" ? Number.parseFloat(amount) : amount;
}

/**
 * Money in whole units for a list's figure cell, where pennies add nothing ("£9,200"). Amounts
 * the seller receives keep their pennies (`formatMoney`).
 */
export function formatWholeMoney(amount: string | number, currency: string): string {
  const n = toAmount(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: normalizeCurrencyCode(currency),
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * An estimate in a list's figure cell: whole units with the symbol once ("£8,000–12,000"), so it
 * fits beside other figures. Pages with room use {@link formatEstimateRange}.
 */
export function formatEstimateRangeShort(input: {
  low: string;
  high: string;
  currency: string;
}): string {
  const high = toAmount(input.high);
  if (!Number.isFinite(toAmount(input.low)) || !Number.isFinite(high)) return "—";
  const tail = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(high);
  return `${formatWholeMoney(input.low, input.currency)}–${tail}`;
}
