import type { PaySeveralSkipReason } from "@auction/domain";
import { z } from "zod";
import type { PaySeveralPlanView } from "./pay-several";

const skipReason = z.enum([
  "other_account",
  "not_owed",
  "not_payer",
  "not_invoiced",
  "held_for_review",
  "being_paid",
]) satisfies z.ZodType<PaySeveralSkipReason>;

const planSchema = z.object({
  payable: z.array(z.object({ lotId: z.string(), totalDue: z.string() })),
  skipped: z.array(z.object({ lotId: z.string(), reason: skipReason })),
  total: z.string(),
  currency: z.string(),
  /** Whether (and how) one payment can take the total. */
  payTogether: z
    .union([
      z.object({ allowed: z.literal(true) }).passthrough(),
      z.object({
        allowed: z.literal(false),
        reason: z.enum(["payer_on_hold", "below_minimum", "over_limit", "needs_finance_review"]),
      }),
    ])
    .optional(),
});

/** The plan the API sent, as the dialog shows it; `null` when it is not a plan. */
export function parsePaySeveralPlan(data: unknown): PaySeveralPlanView | null {
  const parsed = planSchema.safeParse(data);
  if (!parsed.success) return null;
  const { payTogether, ...plan } = parsed.data;
  return { ...plan, block: payTogether && !payTogether.allowed ? payTogether.reason : null };
}
