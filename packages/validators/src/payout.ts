import { payoutStatuses } from "@auction/types";
import { z } from "zod";

const decimalString = z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid decimal string");

/** Fewest characters of reason staff give for a money action on a payout. */
export const PAYOUT_ACTION_REASON_MIN = 10;
export const PAYOUT_ACTION_REASON_MAX = 1000;

/** Create Payout Adjustment Input (admin) */
export const createPayoutAdjustmentSchema = z.object({
  amount: decimalString.refine(
    (s) => Number.parseFloat(s) !== 0,
    "Adjustment amount cannot be zero",
  ),
  note: z.string().min(PAYOUT_ACTION_REASON_MIN).max(PAYOUT_ACTION_REASON_MAX),
});

export type CreatePayoutAdjustmentInput = z.infer<typeof createPayoutAdjustmentSchema>;

/** Admin manual reverse payout (typed confirmation phrase validated in route). */
export const adminManualReversePayoutSchema = z.object({
  reason: z.string().min(PAYOUT_ACTION_REASON_MIN).max(PAYOUT_ACTION_REASON_MAX),
  confirmationPhrase: z.string().min(1).max(500),
});

export type AdminManualReversePayoutInput = z.infer<typeof adminManualReversePayoutSchema>;

const blockedPayoutReason = z
  .string()
  .trim()
  .min(PAYOUT_ACTION_REASON_MIN)
  .max(PAYOUT_ACTION_REASON_MAX);

/**
 * Admin: the two ways out of a `transfer_blocked` payout. Adopt names the Stripe transfer that
 * already pays it; release sends it back to `failed` once staff have checked Stripe holds no live
 * transfer for it, which staff must confirm.
 */
export const resolveBlockedPayoutSchema = z.discriminatedUnion("resolution", [
  z.object({
    resolution: z.literal("adopt_transfer"),
    stripeTransferId: z
      .string()
      .trim()
      .regex(/^tr_[A-Za-z0-9]+$/, "Enter a Stripe transfer ID, such as tr_…"),
    reason: blockedPayoutReason,
  }),
  z.object({
    resolution: z.literal("release_to_failed"),
    noLiveTransferConfirmed: z.literal(true),
    reason: blockedPayoutReason,
  }),
]);

export type ResolveBlockedPayoutInput = z.infer<typeof resolveBlockedPayoutSchema>;

/** List Payouts Query */
export const listPayoutsQuerySchema = z.object({
  legalEntityId: z.string().uuid().optional(),
  status: z.enum(payoutStatuses).optional(),
  /** Admin list search: a payout reference, the start of a payout id, or a seller name. */
  search: z.string().trim().max(100).optional(),
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Run Settlement Input (admin) */
/** Money actions on a payout name why, for the audit log. */
export const payoutActionReasonSchema = z
  .string()
  .trim()
  .min(PAYOUT_ACTION_REASON_MIN)
  .max(PAYOUT_ACTION_REASON_MAX);

export const runSettlementSchema = z.object({
  legalEntityId: z.string().uuid().optional(), // if omitted, runs for all eligible
  dryRun: z.boolean().optional().default(false),
  reason: payoutActionReasonSchema,
  /** Optional start of the period; it must follow the last settled period. Defaults to that end. */
  periodStart: z.string().datetime().optional(),
  /**
   * What the person confirmed from the preview: the net in pence and the ready payments and
   * released deals behind it. The run pays exactly this or refuses with `figures_changed`.
   */
  confirmed: z
    .object({
      netPence: z.number().int().safe(),
      paymentIds: z.array(z.string().uuid()).max(5000),
      dealIds: z.array(z.string().uuid()).max(5000),
    })
    .optional(),
});

export type RunSettlementInput = z.infer<typeof runSettlementSchema>;

/** Payout Method Configuration Input */
export const configurePayoutMethodSchema = z.object({
  provider: z.literal("stripe_connect"),
  isDefault: z.boolean().optional().default(true),
});

export type ConfigurePayoutMethodInput = z.infer<typeof configurePayoutMethodSchema>;

/** Refunding a buyer for a held payment names why, for the audit log. */
export const ADMIN_REFUND_BUYER_REASON_MIN = 10;
export const adminRefundBuyerBodySchema = z.object({
  reason: z.string().trim().min(ADMIN_REFUND_BUYER_REASON_MIN).max(500),
});

export type AdminRefundBuyerInput = z.infer<typeof adminRefundBuyerBodySchema>;

/**
 * Refunding a captured payment from the staff tools (`POST /payments/:id/refund`). The reason is
 * kept on the audit event; it is optional so seller-entity callers without one still work.
 */
export const paymentRefundBodySchema = z.object({
  reason: z.string().trim().min(ADMIN_REFUND_BUYER_REASON_MIN).max(500).optional(),
});

export type PaymentRefundInput = z.infer<typeof paymentRefundBodySchema>;
