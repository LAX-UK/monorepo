import { payoutStatuses } from "@auction/types";
import { z } from "zod";

const decimalString = z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

/** Create Payout Adjustment Input (admin) */
export const createPayoutAdjustmentSchema = z.object({
  amount: decimalString.refine(
    (s) => Number.parseFloat(s) !== 0,
    "Adjustment amount cannot be zero",
  ),
  note: z.string().min(10).max(1000),
});

export type CreatePayoutAdjustmentInput = z.infer<typeof createPayoutAdjustmentSchema>;

/** Admin manual reverse payout (typed confirmation phrase validated in route). */
export const adminManualReversePayoutSchema = z.object({
  reason: z.string().min(10).max(1000),
  confirmationPhrase: z.string().min(1).max(500),
});

export type AdminManualReversePayoutInput = z.infer<typeof adminManualReversePayoutSchema>;

/** List Payouts Query */
export const listPayoutsQuerySchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(payoutStatuses).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Run Settlement Input (admin) */
export const runSettlementSchema = z.object({
  legalEntityId: z.string().uuid().optional(), // if omitted, runs for all eligible
  dryRun: z.boolean().optional().default(false),
});

export type RunSettlementInput = z.infer<typeof runSettlementSchema>;

/** Payout Method Configuration Input */
export const configurePayoutMethodSchema = z.object({
  provider: z.literal("stripe_connect"),
  isDefault: z.boolean().optional().default(true),
});

export type ConfigurePayoutMethodInput = z.infer<typeof configurePayoutMethodSchema>;
