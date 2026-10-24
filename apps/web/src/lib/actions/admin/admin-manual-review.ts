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

function idempotencyHeader(key: string | undefined): Record<string, string> {
  const supplied = key?.trim() ?? "";
  return {
    [IDEMPOTENCY_KEY_HEADER]:
      supplied.length >= 8 && supplied.length <= 128 ? supplied : crypto.randomUUID(),
  };
}

/** The API's answer as an action result; a stale sign-in becomes the step-up code. */
async function callResult(res: Response, fallback: string): Promise<ActionResult<void>> {
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

/** Releases a held payment so the buyer can check out; no money moves until Stripe confirms. */
export async function releaseManualReviewPaymentResultAction(
  paymentId: string,
  input: { idempotencyKey?: string } = {},
): Promise<ActionResult<void>> {
  return instrumentServerAction("releaseManualReviewPaymentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(PAYMENT_MANUAL_REVIEW_WRITE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) return actionFailure("Missing payment");
    const res = await authedServerFetch(
      `/admin/payments/${encodeURIComponent(id)}/capture-and-process`,
      { method: "POST", headers: idempotencyHeader(input.idempotencyKey) },
    );
    return callResult(res, "The payment could not be released.");
  });
}

/** Refunds the winner of a held payment, with the reason kept on the audit event. */
export async function refundManualReviewPaymentResultAction(
  paymentId: string,
  input: { reason: string; idempotencyKey?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("refundManualReviewPaymentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(PAYMENT_MANUAL_REVIEW_WRITE_ACCESS);
    if (denied) return denied;
    const id = paymentId.trim();
    if (!id) return actionFailure("Missing payment");
    const parsed = adminRefundBuyerBodySchema.safeParse({ reason: input.reason });
    if (!parsed.success) {
      const message = `Enter a reason of at least ${ADMIN_REFUND_BUYER_REASON_MIN} characters.`;
      return actionFailure(message, { reason: [message] }, 400);
    }
    const res = await authedServerFetch(`/admin/payments/${encodeURIComponent(id)}/refund-buyer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...idempotencyHeader(input.idempotencyKey) },
      body: JSON.stringify(parsed.data),
    });
    return callResult(res, "The refund did not go through.");
  });
}
