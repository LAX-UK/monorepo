"use server";

import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { createPaymentBodySchema } from "@auction/validators";

export async function createCheckoutPaymentAction(lotId: string): Promise<ActionResult<void>> {
  const parsed = createPaymentBodySchema.safeParse({ lotId });
  if (!parsed.success) {
    return actionFailure("Invalid lot");
  }
  const { payments } = getWriteContainer();
  const r = await payments.createPayment(parsed.data);
  if (!r.ok) {
    return actionFailure(r.message, undefined, r.status);
  }
  return actionSuccess();
}
