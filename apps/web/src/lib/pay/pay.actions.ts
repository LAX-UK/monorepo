"use server";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadPayPlan, postPay } from "./pay-api.server";
import { PAY_COPY } from "./pay-copy";
import { type PayStartResult, payStartResult } from "./pay-start";

const payInputSchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1).max(20),
  expectedTotalPence: z.number().int().positive().max(99_999_999),
});

/**
 * Opens the payment for exactly what the page showed: the lots and the total in whole pence. The
 * server pays that plan or none; if it has changed, the answer says so and nothing is charged.
 */
export async function payAction(input: {
  lotIds: string[];
  expectedTotalPence: number;
}): Promise<PayStartResult> {
  return instrumentServerAction("payAction", async () => {
    const parsed = payInputSchema.safeParse(input);
    if (!parsed.success) return { kind: "failed", message: PAY_COPY.startFailed, refresh: false };
    const { lotIds, expectedTotalPence } = parsed.data;
    const response = await postPay({ lotIds, expectedTotalPence });
    const result = await payStartResult(response, expectedTotalPence, async () => {
      const now = await loadPayPlan(lotIds);
      return now.kind === "ok" ? now.plan : null;
    });
    if (result.kind === "redirect") revalidatePath(CLIENT_ROUTES.purchases);
    return result;
  });
}
