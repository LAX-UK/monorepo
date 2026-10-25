"use server";

import { readApiError } from "@/lib/actions/_utils";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import {
  type ActionResult,
  actionFailure,
  actionSuccess,
  firstZodErrorMessage,
} from "@/lib/forms/form-result";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const saleRegistrationActionParams = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

const saleRegistrationDecisionInput = saleRegistrationActionParams.extend({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional(),
});

/**
 * Approves or rejects a registration and answers with a result, so the dialog that asked can keep
 * a failure in view. A rejection may carry a reason, which is kept with the registration.
 */
export async function adminDecideSaleRegistrationResultAction(
  input: unknown,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminDecideSaleRegistrationResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const parsed = saleRegistrationDecisionInput.safeParse(input);
    if (!parsed.success) return actionFailure(firstZodErrorMessage(parsed.error));
    const { saleId, registrationId, decision, reason } = parsed.data;
    const registrations = getWriteContainer().adminSaleRegistrations;
    const res =
      decision === "approve"
        ? await registrations.approve(saleId, registrationId)
        : await registrations.reject(saleId, registrationId, reason || undefined);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, decision === "approve" ? "Approve failed" : "Reject failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    revalidatePath(`/admin/sales/${saleId}/registrations`);
    return actionSuccess();
  });
}
