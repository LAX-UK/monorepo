import { saleBuyerPremiumCopy } from "@/lib/lot/buyer-premium-copy";
import { formatMoney } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";

export function sumLotHammers(lots: Lot[]): string {
  let total = 0;
  for (const l of lots) {
    const n = Number.parseFloat(String(l.currentPrice ?? "0"));
    if (!Number.isNaN(n)) total += n;
  }
  return formatMoney(total);
}

/** The sale's premium in words: "15% up to £500,000, then 10% on the part above" or "20% on the hammer". */
export function buyerPremiumSummary(
  sale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">,
): string {
  return saleBuyerPremiumCopy(sale).terms;
}

export function venueOneLiner(sale: Sale): string | null {
  const parts = [sale.locationName, sale.locationCity].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function saleVenueLines(sale: Sale): string[] {
  return [
    sale.locationName,
    [sale.locationAddressLine1, sale.locationAddressLine2].filter(Boolean).join(", ") || null,
    [sale.locationCity, sale.locationCounty, sale.locationPostcode].filter(Boolean).join(", ") ||
      null,
    sale.locationCountry,
    sale.locationAddress,
  ].filter(Boolean) as string[];
}

export function isSaleLiveish(sale: Sale): boolean {
  return sale.status === "scheduled" || sale.status === "active";
}
