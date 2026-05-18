"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { CreatePaymentResponse } from "@auction/types";
import { createPaymentBodySchema } from "@auction/validators";

export async function createCheckoutPaymentAction(
  lotId: string,
  addressId?: string,
): Promise<ActionResult<{ checkoutUrl: string | null; paymentId: string }>> {
  if (addressId && !/^[0-9a-f-]{36}$/i.test(addressId)) {
    return actionFailure("Choose a valid address");
  }
  const parsed = createPaymentBodySchema.safeParse({ lotId });
  if (!parsed.success) {
    return actionFailure("Invalid lot");
  }
  const { payments } = getWriteContainer();
  const r = await payments.createPayment(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  const data: CreatePaymentResponse = r.data;
  return actionSuccess({
    checkoutUrl: data.checkoutUrl ?? null,
    paymentId: data.paymentId,
  });
}
