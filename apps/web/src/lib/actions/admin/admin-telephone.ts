"use server";

import { readApiError } from "@/lib/actions/_utils";
import { revalidateAdminSaleDetail } from "@/lib/actions/revalidate-admin-sale-detail";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const telephoneBookingActionForm = z.object({
  saleId: z.string().uuid(),
  bookingId: z.string().uuid(),
});

const telephoneAssignClerkForm = telephoneBookingActionForm.extend({
  clerkUserId: z.string().min(1).max(191),
});

const telephoneNotesForm = telephoneBookingActionForm.extend({
  notes: z.string().max(2000),
});

function revalidateTelephoneBookingPaths(saleId: string) {
  revalidatePath(`/admin/sales/${saleId}/telephone-bookings`);
  revalidatePath(`/admin/sales/${saleId}/operations`);
  revalidatePath(`/admin/saleroom/${saleId}`);
  revalidateAdminSaleDetail(saleId);
}

const telephoneBookingResultInput = z.discriminatedUnion("action", [
  telephoneBookingActionForm.extend({
    action: z.enum(["confirm", "close", "approve-limit-increase"]),
  }),
  telephoneBookingActionForm.extend({
    action: z.literal("cancel"),
    reason: z.string().trim().max(500).optional(),
  }),
  telephoneAssignClerkForm.extend({ action: z.literal("assign-clerk") }),
  telephoneNotesForm.extend({ action: z.literal("notes") }),
]);

/**
 * One telephone booking action (confirm, close, cancel, approve a limit increase, assign a clerk,
 * save notes) answered with a result, so the dialog that asked can keep a failure in view.
 */
export async function adminTelephoneBookingResultAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminTelephoneBookingResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;
    const parsed = telephoneBookingResultInput.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const data = parsed.data;
    const { saleId, bookingId } = data;
    const writes = getWriteContainer().adminTelephone;
    const res =
      data.action === "notes"
        ? await writes.updateNotes(saleId, bookingId, data.notes)
        : await writes.bookingAction(
            saleId,
            bookingId,
            data.action,
            data.action === "cancel"
              ? data.reason
                ? { reason: data.reason }
                : {}
              : data.action === "assign-clerk"
                ? { clerkUserId: data.clerkUserId }
                : undefined,
          );
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "That booking action failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    revalidateTelephoneBookingPaths(saleId);
    return actionSuccess();
  });
}
