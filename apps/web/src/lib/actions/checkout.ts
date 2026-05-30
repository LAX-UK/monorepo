"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import { checkoutPaymentErrorMessage } from "@/lib/checkout/checkout-payment-errors";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { CreatePaymentResponse } from "@auction/types";
import type { ManualReviewReason } from "@auction/types";
import { createPaymentBodySchema } from "@auction/validators";

export type CheckoutPaymentActionData = {
  checkoutUrl: string | null;
  paymentId: string;
  manualReviewReason: ManualReviewReason | null;
};

export async function createCheckoutPaymentAction(
  lotId: string,
  addressId: string,
): Promise<ActionResult<CheckoutPaymentActionData>> {
  return instrumentServerAction("createCheckoutPaymentAction", async () => {
    const parsed = createPaymentBodySchema.safeParse({ lotId, addressId });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Invalid checkout request";
      return actionFailure(typeof msg === "string" ? msg : "Invalid checkout request");
    }
    const { payments } = getWriteContainer();
    const r = await payments.createPayment(parsed.data);
    if (!r.ok) {
      return actionFailure(
        checkoutPaymentErrorMessage(r.message, r.code),
        undefined,
        r.status,
        r.code,
      );
    }
    const data: CreatePaymentResponse = r.data;
    return actionSuccess({
      checkoutUrl: data.checkoutUrl ?? null,
      paymentId: data.paymentId,
      manualReviewReason: data.manualReviewReason ?? null,
    });
  });
}
