"use server";

import { normalizeFinanceApiError } from "@/lib/admin/finance/finance-action-errors";
import { IDEMPOTENCY_KEY_HEADER } from "@/lib/admin/finance/idempotency-key";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { isStaffStepUpResponse } from "@/lib/auth/step-up/staff-step-up.server";
import { stepUpRequiredFailure } from "@/lib/auth/step-up/step-up-failure";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { PAYMENT_MANUAL_REVIEW_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  ADMIN_REFUND_BUYER_REASON_MIN,
  adminRefundGroupDeliveryBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const idSchema = z.string().uuid();

/**
 * "12.50" or "£12.50" to whole pence; blank means the rest of the courier charge. Anything else
 * (letters, three decimals, zero or less) is `null`.
 */
function penceFrom(amount: string | undefined): number | undefined | null {
  const text = (amount ?? "").trim().replace(/^£/, "");
  if (!text) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const pence = Math.round(Number(text) * 100);
  return pence > 0 ? pence : null;
}

/**
 * Refunds the courier part of a combined payment on its own. The refund names the courier quote,
 * so no invoice and no seller's payout moves. The reason is kept on the audit event.
 */
export async function adminRefundGroupDeliveryResultAction(
  paymentGroupId: string,
  deliveryQuoteId: string,
  input: { reason: string; amount?: string },
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRefundGroupDeliveryResultAction", async () => {
    const denied = await denyUnlessAdminCapability(PAYMENT_MANUAL_REVIEW_WRITE_ACCESS);
    if (denied) return denied;
    const group = idSchema.safeParse(paymentGroupId);
    const quote = idSchema.safeParse(deliveryQuoteId);
    if (!group.success || !quote.success)
      return actionFailure("This courier charge was not found.");
    const pence = penceFrom(input.amount);
    if (pence === null) {
      const message = "Enter an amount in pounds, such as 45.00, or leave it blank.";
      return actionFailure(message, { amount: [message] }, 400);
    }
    const parsed = adminRefundGroupDeliveryBodySchema.safeParse({
      reason: input.reason,
      ...(pence !== undefined ? { amountPence: pence } : {}),
    });
    if (!parsed.success) {
      const message = `Enter a reason of at least ${ADMIN_REFUND_BUYER_REASON_MIN} characters.`;
      return actionFailure(message, { reason: [message] }, 400);
    }
    const res = await authedServerFetch(
      `/admin/payment-groups/${encodeURIComponent(group.data)}/deliveries/${encodeURIComponent(quote.data)}/refund`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [IDEMPOTENCY_KEY_HEADER]: crypto.randomUUID(),
        },
        body: JSON.stringify(parsed.data),
      },
    );
    if (res.ok) {
      revalidatePath("/admin/lot-fulfilment");
      revalidatePath("/admin/payments");
      return actionSuccess();
    }
    if (await isStaffStepUpResponse(res)) return stepUpRequiredFailure();
    const fallback = "The courier refund did not go through.";
    const message = (await normalizeFinanceApiError(res, fallback)) ?? fallback;
    return actionFailure(message.replace(/ \(\d{3}\)$/, ""), undefined, res.status);
  });
}
