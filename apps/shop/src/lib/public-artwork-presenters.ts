import type { PublicArtworkSummary } from "@auction/shop-contracts";

/** "Limited edition of 24 · Available": the edition size and a state, never a remaining count. */
export function formatEditionAvailabilitySummary(item: PublicArtworkSummary): string {
  if (!item.eligibleForEditionAllocation) {
    return "Original — one of one";
  }
  const { totalEditions, state } = item.availability;
  const stateLabel = state === "sold_out" ? "Sold out" : "Available";
  return totalEditions > 0 ? `Limited edition of ${totalEditions} · ${stateLabel}` : stateLabel;
}
