import type { AtgLotSyncView } from "@auction/types";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

export type AtgLotState = { label: string; variant: StatusBadgeProps["variant"] };

/** Staff-facing label for a lot's ATG state, derived from fields GAP documents. */
export function atgLotState(
  lot: Pick<AtgLotSyncView, "atgLotId" | "lastError" | "sold" | "numberOfBids">,
): AtgLotState {
  if (lot.lastError) return { label: "Sync error", variant: "danger" };
  if (!lot.atgLotId) return { label: "Not pushed", variant: "neutral" };
  if (lot.sold) return { label: "Sold", variant: "success" };
  const bids = lot.numberOfBids ?? 0;
  if (bids > 0) return { label: bids === 1 ? "1 bid" : `${bids} bids`, variant: "info" };
  return { label: "On ATG", variant: "info" };
}
