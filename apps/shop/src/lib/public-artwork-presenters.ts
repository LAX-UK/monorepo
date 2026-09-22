import type { PublicArtworkSummary } from "@auction/shop-contracts";

export function formatEditionAvailabilitySummary(item: PublicArtworkSummary): string {
  if (!item.eligibleForEditionAllocation) {
    return "Original — one of one";
  }
  const { editionsAvailable, totalEditions } = item.availability;
  if (editionsAvailable <= 0) {
    return totalEditions > 0 ? `Sold out — all ${totalEditions} claimed` : "Sold out";
  }
  return `${editionsAvailable} of ${totalEditions} editions available`;
}
