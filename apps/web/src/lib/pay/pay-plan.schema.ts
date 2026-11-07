import { type PayPlan, invoiceLineKinds } from "@auction/types";
import { z } from "zod";

const leftOutReason = z.enum([
  "other_account",
  "paid",
  "being_confirmed",
  "not_payer",
  "held_for_review",
  "being_paid",
  "cancelled",
  "refunded",
  "voided",
]);

const invoiceLine = z.object({
  kind: z.enum(invoiceLineKinds),
  label: z.string(),
  ratePercent: z.string().nullable(),
  amountPence: z.number().int(),
});

const gate = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("clear") }),
  z.object({ kind: z.literal("not_payer"), payingAccountName: z.string() }),
  z.object({ kind: z.literal("onboarding_required") }),
  z.object({ kind: z.literal("refused"), reason: z.literal("organisation_closed") }),
  z.object({
    kind: z.literal("held"),
    reason: z.enum(["identity_verification_required", "organisation_under_review"]),
  }),
  z.object({
    kind: z.literal("compliance"),
    reason: z.enum(["aml_hold", "source_of_funds_required"]),
    subject: z.enum(["payer", "winner"]),
  }),
  z.object({ kind: z.literal("finance_check") }),
]);

const payPlanSchema = z.object({
  account: z.object({
    legalEntityId: z.string(),
    kind: z.enum(["individual", "organisation"]),
    name: z.string(),
  }),
  payerRole: z.enum(["payer", "informed"]),
  entity: z.object({
    name: z.string(),
    address: z.string(),
    companyNumber: z.string().nullable(),
    vatNumber: z.string().nullable(),
  }),
  gate,
  payable: z.array(
    z.object({
      lotId: z.string(),
      paymentId: z.string().nullable(),
      invoiceId: z.string().nullable(),
      title: z.string(),
      lotNumber: z.number().int().nullable(),
      saleTitle: z.string().nullable(),
      lines: z.array(invoiceLine),
      totalPence: z.number().int(),
      dueAt: z.string(),
      overdue: z.boolean(),
    }),
  ),
  leftOut: z.array(z.object({ lotId: z.string(), reason: leftOutReason })),
  totals: z.object({
    pence: z.number().int(),
    byKind: z.array(z.object({ kind: z.enum(invoiceLineKinds), pence: z.number().int() })),
  }),
  firstDueAt: z.string().nullable(),
  methods: z.array(
    z.object({
      method: z.enum(["card", "bank_transfer"]),
      available: z.boolean(),
      reason: z.enum(["over_card_limit", "within_card_limit", "over_online_limit"]).nullable(),
    }),
  ),
  currency: z.literal("GBP"),
}) satisfies z.ZodType<PayPlan, z.ZodTypeDef, unknown>;

/** The plan the API sent for the Pay page; `null` when what came back is not a plan. */
export function parsePayPlan(data: unknown): PayPlan | null {
  const parsed = payPlanSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
