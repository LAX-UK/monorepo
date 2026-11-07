"use server";

import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadPayPlan, postPay } from "./pay-api.server";
import { PAY_COPY } from "./pay-copy";
import type { PayMethod } from "./pay-methods";
import { progressSignature } from "./pay-progress.vm";
import { type PayStartResult, payStartResult } from "./pay-start";

const payInputSchema = z.object({
  lotIds: z.array(z.string().uuid()).min(1).max(20),
  expectedTotalPence: z.number().int().positive().max(99_999_999),
  method: z.enum(["card", "bank_transfer"]),
});

const lotIdsSchema = z.array(z.string().uuid()).min(1).max(20);

/**
 * Opens the payment for exactly what the page showed: the lots and the total in whole pence. The
 * server pays that plan or none; if it has changed, the answer says so and nothing is charged.
 */
export async function payAction(input: {
  lotIds: string[];
  expectedTotalPence: number;
  method: PayMethod;
}): Promise<PayStartResult> {
  return instrumentServerAction("payAction", async () => {
    const parsed = payInputSchema.safeParse(input);
    if (!parsed.success) return { kind: "failed", message: PAY_COPY.startFailed, refresh: false };
    const { lotIds, expectedTotalPence, method } = parsed.data;
    try {
      const response = await postPay({ lotIds, expectedTotalPence, method });
      const result = await payStartResult(response, expectedTotalPence, async () => {
        const now = await loadPayPlan(lotIds);
        return now.kind === "ok" ? now.plan : null;
      });
      if (result.kind === "redirect") revalidatePath(CLIENT_ROUTES.purchases);
      return result;
    } catch {
      // A failure on our side before an answer: nothing was opened, so the page is read again.
      return { kind: "failed", message: PAY_COPY.startFailed, refresh: true };
    }
  });
}

/**
 * Where a payment under way for these lots stands, as a short string that changes when it moves
 * (see `progressSignature`). The page asks while it waits and reads itself again when the answer
 * differs from what it shows. `null` when the server could not be read: the page keeps waiting.
 */
export async function payProgressAction(lotIds: string[]): Promise<string | null> {
  return instrumentServerAction("payProgressAction", async () => {
    const parsed = lotIdsSchema.safeParse(lotIds);
    if (!parsed.success) return null;
    const read = await loadPayPlan(parsed.data);
    return read.kind === "ok" ? progressSignature(read.plan.progress) : null;
  });
}
