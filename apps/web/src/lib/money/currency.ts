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

/** Display currency for lot prices and bids (from estimate metadata, else platform default). */
export function resolveLotCurrency(lot: LotCurrencySource): string {
  return normalizeCurrencyCode(lot.marketingDetails?.estimate?.currency);
}

export function formatEstimateRange(input: {
  low: string;
  high: string;
  currency: string;
}): string {
  const currency = normalizeCurrencyCode(input.currency);
  return `${formatMoney(input.low, currency)} – ${formatMoney(input.high, currency)}`;
}
