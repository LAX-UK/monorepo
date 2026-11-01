import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { defineStatusMap } from "@auction/ui/lax";

/**
 * How each public saleroom session status reads: one table, so a new status is one row. Live is
 * the neutral badge with the pulsing live dot; red is kept for what has gone wrong.
 */
export const presentSaleroomSession = defineStatusMap<PublicSaleroomSessionStatus["status"]>({
  none: { label: "Not started", tone: "neutral" },
  pending: { label: "Not started", tone: "neutral" },
  live: { label: "Live", tone: "neutral", live: true },
  paused: { label: "Paused", tone: "warning" },
  ended: { label: "Ended", tone: "neutral", shape: "check" },
});
