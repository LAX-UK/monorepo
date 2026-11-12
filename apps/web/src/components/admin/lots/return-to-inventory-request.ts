import type { StaffConfirmRequest } from "@/components/admin/staff/use-staff-confirm";
import { adminReturnLotToInventoryResultAction } from "@/lib/actions/admin";
import type { LotStatus } from "@auction/types";

/** The confirm for sending a lot back to inventory: the lot menu and the Re-offer card share it. */
export function returnToInventoryRequest(lot: {
  id: string;
  title: string;
  status: LotStatus;
}): StaffConfirmRequest {
  return {
    title: `Return ${lot.title} to inventory?`,
    description:
      "Takes the lot out of its sale and clears its lot number, winner and price back to the starting price. Its bid history is kept, marked as not winning.",
    confirmLabel: "Return to inventory",
    tone: "danger",
    reason: { label: "Reason", description: "Kept in the audit log.", maxLength: 500 },
    run: ({ reason }) =>
      adminReturnLotToInventoryResultAction(lot.id, {
        reason,
        confirmVoided: lot.status === "voided",
      }),
    success: `${lot.title} returned to inventory`,
  };
}
