import { type AtgLotSyncView, atgLotStateLabel } from "@auction/types";
import type { StatusBadgeProps } from "@auction/ui/components/status-badge";

export type AtgLotState = { label: string; variant: StatusBadgeProps["variant"] };

const STATUS_VARIANT: Record<string, StatusBadgeProps["variant"]> = {
  "Sync error": "danger",
  "Not yet offered": "neutral",
  Offered: "info",
  "Not sold": "neutral",
  Sold: "success",
};

/** Staff-facing label (shared with the header badge). Sync errors win over everything else. */
export function atgLotState(
  lot: Pick<AtgLotSyncView, "atgLotId" | "lastError" | "sold" | "numberOfBids" | "remoteStatus">,
): AtgLotState {
  if (!lot.atgLotId && !lot.lastError) return { label: "Not pushed", variant: "neutral" };
  const label = atgLotStateLabel(lot) ?? "On ATG";
  return { label, variant: STATUS_VARIANT[label] ?? "info" };
}
