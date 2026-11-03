"use server";

import { normalizeFinanceApiError } from "@/lib/admin/finance/finance-action-errors";
import { IDEMPOTENCY_KEY_HEADER } from "@/lib/admin/finance/idempotency-key";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { PAYMENT_MANUAL_REVIEW_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts/staff-step-up";
import { ADMIN_REFUND_BUYER_REASON_MIN, adminRefundBuyerBodySchema } from "@auction/validators";
import { revalidatePath } from "next/cache";

async function toResult(res: Response, fallback: string): Promise<ActionResult<void>> {
  if (res.ok) {
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return actionSuccess();
  }
  if (await isStaffStepUpResponse(res)) {
    return actionFailure("Recent sign-in required", undefined, 403, STAFF_STEP_UP_REQUIRED);
  }
  const message = (await normalizeFinanceApiError(res, fallback)) ?? fallback;
  return actionFailure(message.replace(/ \(\d{3}\)$/, ""), undefined, res.status);
}

/** Records a payment Stripe took after it was closed as paid, so the buyer's purchase goes ahead. */
export async function reinstateBlockedCaptureResultAction(
  paymentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("reinstateBlockedCaptureResultAction", async () => {
    const denied = await denyUnlessAdminCapability(PAYMENT_MANUAL_REVIEW_WRITE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) return actionFailure("Missing payment");
    const res = await authedServerFetch(
      `/admin/payments/${encodeURIComponent(id)}/reinstate-blocked-capture`,
      { method: "POST", headers: { [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID() } },
    );
    return toResult(res, "The payment could not be reinstated.");
  });
}

/** Returns money Stripe took after the payment was closed, with the reason kept in the audit log. */
export async function refundBlockedCaptureResultAction(
  paymentId: string,
  input: { reason: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("refundBlockedCaptureResultAction", async () => {
    const denied = await denyUnlessAdminCapability(PAYMENT_MANUAL_REVIEW_WRITE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) return actionFailure("Missing payment");
    const parsed = adminRefundBuyerBodySchema.safeParse({ reason: input.reason });
    if (!parsed.success) {
      const message = `Enter a reason of at least ${ADMIN_REFUND_BUYER_REASON_MIN} characters.`;
      return actionFailure(message, { reason: [message] }, 400);
    }
    const res = await authedServerFetch(
      `/admin/payments/${encodeURIComponent(id)}/refund-blocked-capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
        },
        body: JSON.stringify(parsed.data),
      },
    );
    return toResult(res, "The refund did not go through.");
  });
}
