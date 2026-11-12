import { startingPriceText } from "@/lib/offer-at-auction-form";
import { formatStaffMoney } from "@auction/staff-ui";

/** Zoho's price ("4800.00", pounds) as "£4,800.00"; null when Zoho has none. */
export function zohoPriceLabel(zohoPrice: string | null): string | null {
  if (zohoPrice === null) return null;
  const pounds = Number(zohoPrice);
  return Number.isFinite(pounds) && pounds > 0 ? formatStaffMoney(Math.round(pounds * 100)) : null;
}

/**
 * Zoho's price beside the price typed in LAX. It is information, never a rule: the LAX price is
 * the one that is used, so a difference is flagged in a neutral tone and never blocks anything.
 * A price that is blank or not yet a valid amount is not compared.
 */
export function compareWithZohoPrice(
  zohoPrice: string | null,
  priceText: string,
): { label: string | null; differs: boolean } {
  const label = zohoPriceLabel(zohoPrice);
  if (label === null || zohoPrice === null) return { label: null, differs: false };
  const typed = startingPriceText(priceText);
  return { label, differs: typed !== null && typed !== Number(zohoPrice).toFixed(2) };
}
