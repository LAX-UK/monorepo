"use server";

import { DELIVERIES_PATH } from "@/lib/admin/deliveries/deliveries.vm";
import { deliveryDeclineErrorMessage } from "@/lib/admin/deliveries/delivery-decline";
import { idempotencyHeader } from "@/lib/admin/finance/idempotency-key";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { DELIVERIES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { adminDeliveryDeclineBodySchema, adminDeliveryLotIdParamSchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

/**
 * The code a refusal carries. The route's own errors are `{error: <code>, message}`; the shared
 * idempotency middleware's are `{error: <sentence>, code}`, so `code` is read first.
 */
async function errorCodeOf(res: Response): Promise<string | undefined> {
  const body = (await res.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
  if (typeof body?.code === "string") return body.code;
  return typeof body?.error === "string" ? body.error : undefined;
}

/**
 * "Can't deliver" (D8): declines the request staff were looking at (`quoteId` in
 * `expectedStatus`) with the reason the buyer is emailed. One decline per `idempotencyKey`, so a
 * double submit sends one email. A request that moved on answers `quote_changed` or
 * `quote_step_not_allowed`, which the dialog shows as the D6 stale Notice.
 */
export async function declineDeliveryAction(
  lotId: string,
  input: unknown,
  idempotencyKey: string,
): Promise<ActionResult> {
  return instrumentServerAction("declineDeliveryAction", async () => {
    const denied = await denyUnlessAdminCapability(DELIVERIES_ACCESS);
    if (denied) return denied;
    const param = adminDeliveryLotIdParamSchema.safeParse({ lotId });
    const body = adminDeliveryDeclineBodySchema.safeParse(input);
    if (!param.success || !body.success) {
      return actionFailure(
        body.error?.issues[0]?.message ?? deliveryDeclineErrorMessage(undefined, 400),
        undefined,
        400,
      );
    }
    const res = await authedServerFetch(
      `/admin/deliveries/${encodeURIComponent(param.data.lotId)}/decline`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...idempotencyHeader(idempotencyKey) },
        body: JSON.stringify(body.data),
      },
    ).catch(() => null);
    if (!res)
      return actionFailure(deliveryDeclineErrorMessage(undefined, undefined), undefined, 503);
    if (!res.ok) {
      const code = await errorCodeOf(res);
      return actionFailure(
        deliveryDeclineErrorMessage(code, res.status),
        undefined,
        res.status,
        code,
      );
    }
    revalidatePath(DELIVERIES_PATH);
    return actionSuccess();
  });
}
