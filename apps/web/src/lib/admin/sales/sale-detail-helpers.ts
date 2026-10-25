import { formatMoney } from "@/lib/ui/format";
import { formatGbp, formatStaffPercent } from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";

export function sumLotHammers(lots: Lot[]): string {
  let total = 0;
  for (const l of lots) {
    const n = Number.parseFloat(String(l.currentPrice ?? "0"));
    if (!Number.isNaN(n)) total += n;
  }
  return formatMoney(total);
}

/** "25% on the hammer", or the bands: "20% from £0.00, 15% from £500,000.00". */
export function buyerPremiumSummary(
  sale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">,
): string {
  const tiers = sale.buyerPremiumTiers;
  if (tiers && tiers.length > 0) {
    return tiers
      .map((t) => `${formatStaffPercent(t.rate)} from ${formatGbp(t.hammerThresholdMinor)}`)
      .join(", ");
  }
  if (!sale.buyerPremiumRate?.trim()) return "Not set";
  return `${formatStaffPercent(sale.buyerPremiumRate)} on the hammer`;
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
