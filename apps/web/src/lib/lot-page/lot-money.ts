import { formatMoney } from "@/lib/format-currency";
import { PLATFORM_DEFAULT_CURRENCY, formatWholeMoney } from "@/lib/money/currency";

/**
 * Money as the lot page prints it: whole pounds when there are no pence ("£7,250"), pence
 * otherwise ("£7,250.50"). The one formatter for the price block, the history and the dialog.
 */
export function formatLotMoney(amount: string, currency = PLATFORM_DEFAULT_CURRENCY): string {
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? formatWholeMoney(value, currency) : formatMoney(value, currency);
}
