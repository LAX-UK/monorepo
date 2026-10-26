import { type AtgLotSyncView, atgLotStatusLabel } from "@auction/types";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

export type AtgLotState = { label: string; variant: StatusBadgeProps["variant"] };

const STATUS_VARIANT: Record<string, StatusBadgeProps["variant"]> = {
  "Not yet offered": "neutral",
  Offered: "info",
  "Not sold": "neutral",
  Sold: "success",
};

/** Staff-facing label. Known GetLots codes win; unknown codes fall back to sold/bids. */
export function atgLotState(
  lot: Pick<AtgLotSyncView, "atgLotId" | "lastError" | "sold" | "numberOfBids" | "remoteStatus">,
): AtgLotState {
  if (lot.lastError) return { label: "Sync error", variant: "danger" };
  if (!lot.atgLotId) return { label: "Not pushed", variant: "neutral" };
  const documented = atgLotStatusLabel(lot.remoteStatus);
  if (documented) return { label: documented, variant: STATUS_VARIANT[documented] ?? "info" };
  if (lot.sold) return { label: "Sold", variant: "success" };
  const bids = lot.numberOfBids ?? 0;
  if (bids > 0) return { label: bids === 1 ? "1 bid" : `${bids} bids`, variant: "info" };
  return { label: "On ATG", variant: "info" };
}
