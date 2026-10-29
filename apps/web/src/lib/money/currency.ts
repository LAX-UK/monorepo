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
