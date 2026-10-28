import type { ConsignmentMoveOptions } from "@auction/types";

/** What staff are told happens to the consignment agreement when it moves. */
export const CONSIGNMENT_MOVE_AGREEMENT_NOTICE: Record<
  ConsignmentMoveOptions["agreementEffect"],
  { tone: "info" | "warning"; title: string; body: string } | null
> = {
  none: null,
  carried: {
    tone: "info",
    title: "The agreement moves with it",
    body: "The seller has not accepted it yet. An owner or admin of the organisation accepts it instead.",
  },
  reset: {
    tone: "warning",
    title: "The seller's acceptance does not carry over",
    body: "They accepted the consignment agreement in their own name. The same terms are proposed to the organisation, and an owner or admin accepts them again before cataloguing.",
  },
};

export const CONSIGNMENT_MOVE_TOLD =
  "The seller and the organisation's owners and admins are told, and the move is recorded in the audit log.";
