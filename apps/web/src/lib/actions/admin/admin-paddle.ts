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
import { SALEROOM_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { z } from "zod";

const paddleRegistrationActionForm = z.object({
  saleId: z.string().uuid(),
  registrationId: z.string().uuid(),
});

const paddleAssignForm = paddleRegistrationActionForm.extend({
  paddleNumber: z.coerce.number().int().min(100).optional(),
});

export async function adminAssignPaddleResultAction(
  input: unknown,
): Promise<ActionResult<{ paddleNumber: number }>> {
  return instrumentServerAction("adminAssignPaddleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = paddleAssignForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { saleId, registrationId, paddleNumber } = parsed.data;
    const res = await getWriteContainer().adminPaddle.assignPaddle(
      saleId,
      registrationId,
      paddleNumber,
    );
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Paddle assignment failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess(res.data);
  });
}

export async function adminClearPaddleResultAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  return instrumentServerAction("adminClearPaddleResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALEROOM_ACCESS);
    if (denied) return denied;

    const parsed = paddleRegistrationActionForm.safeParse(input);
    if (!parsed.success) {
      return actionFailure(firstZodErrorMessage(parsed.error));
    }

    const { saleId, registrationId } = parsed.data;
    const res = await getWriteContainer().adminPaddle.clearPaddle(saleId, registrationId);
    if (!res.ok) {
      return actionFailure(
        readApiError(res.body, "Clear paddle failed"),
        undefined,
        res.status,
        res.code,
      );
    }
    return actionSuccess(res.data);
  });
}
