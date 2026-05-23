import { formatNumber } from "@/lib/ui/format";
import type { Lot, Sale } from "@auction/types";

export function sumLotHammers(lots: Lot[]): string {
  let total = 0;
  for (const l of lots) {
    const n = Number.parseFloat(String(l.currentPrice ?? "0"));
    if (!Number.isNaN(n)) total += n;
  }
  return formatNumber(total, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function buyerPremiumSummary(sale: Sale): string {
  const tiers = sale.buyerPremiumTiers;
  if (tiers && tiers.length > 0) {
    return `${tiers.length} tier${tiers.length === 1 ? "" : "s"} (${tiers.map((t) => `${t.hammerThresholdMinor}+ → ${t.rate}`).join("; ")})`;
  }
  return `${sale.buyerPremiumRate} flat rate`;
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
