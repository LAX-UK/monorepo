import type { StatusPresentation } from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";

/** Every lot status, so a new one fails to compile until it has a staff label. */
export const LOT_STATUS: Record<LotStatus, StatusPresentation> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "info" },
  active: { label: "Live", tone: "live", live: true },
  ended: { label: "Ended", tone: "neutral" },
  cancelled: { label: "Withdrawn", tone: "danger" },
  voided: { label: "Voided", tone: "danger" },
};
