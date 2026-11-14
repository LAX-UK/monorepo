import { z } from "zod";
import { lotEndedPayloadSchema } from "./lot-payload-schemas.js";

const isoDateTime = z.string().datetime();

/**
 * A Bid invoice raised for a won lot. Ids and the total only: readers fetch the rest. The total is
 * positive because a Bid invoice is: the table refuses a total of 0p (`bid_invoice_total_check`),
 * and the event is written in the same transaction as the invoice, so a 0p event cannot exist.
 * If Bid ever allows a 0p invoice, relax both together and let the accounting policy refuse it.
 *
 * `lineIds` names the frozen invoice lines in their order (references only: no labels, no
 * amounts), so a reader can check the lines it reads are the ones raised. Events written before
 * it was added carry none.
 */
export const invoiceRaisedPayloadSchemaV1 = z.object({
  invoiceId: z.string().uuid(),
  lotId: z.string().uuid(),
  buyerLegalEntityId: z.string().uuid(),
  totalPence: z.number().int().positive(),
  raisedAt: isoDateTime,
  lineIds: z.array(z.string().uuid()).min(1).max(1000).optional(),
});

export const paymentCapturedPayloadSchemaV1 = z.object({
  paymentId: z.string().uuid(),
  lotId: z.string().uuid(),
  userId: z.string().nullable(),
  amountCents: z.number().int().nonnegative(),
  capturedAt: isoDateTime,
  stripeIntentId: z.string().nullable().optional(),
  stripeChargeId: z.string().nullable().optional(),
  via: z.enum(["admin_manual", "stripe_checkout_webhook", "stripe_payment_intent"]),
  buyerName: z.string().nullable().optional(),
  buyerEmail: z.string().nullable().optional(),
});

const paymentRefundedAdminPayloadSchemaV1 = z.object({
  amount: z.string(),
  currency: z.literal("GBP"),
  sellerLegalEntityId: z.string().uuid().nullable(),
  via: z.enum(["admin_manual", "admin_manual_review"]),
  stripeRefundId: z.string().nullable(),
  reason: z.enum(["seller_archived"]).optional(),
  /** Staff-typed reason for a manual-review refund. */
  staffReason: z.string().min(1).max(500).optional(),
  reconciled: z.literal(true).optional(),
});

const paymentRefundedWebhookPayloadSchemaV1 = z.object({
  stripeChargeId: z.string(),
  amountCents: z.number().int().nonnegative(),
  cumulativeRefundedCents: z.number().int().nonnegative(),
  currency: z.string(),
  sellerLegalEntityId: z.string().uuid(),
  via: z.literal("stripe_webhook"),
});

export const paymentRefundedPayloadSchemaV1 = z.union([
  paymentRefundedAdminPayloadSchemaV1,
  paymentRefundedWebhookPayloadSchemaV1,
]);

export const payoutPaidPayloadSchemaV1 = z.object({
  legalEntityId: z.string().uuid(),
  status: z.literal("paid"),
  stripeTransferId: z.string().nullable(),
  grossAmount: z.string(),
  platformFee: z.string(),
  stripeFee: z.string(),
  netAmount: z.string(),
  currency: z.string(),
  processedAt: isoDateTime.nullable(),
  via: z.string(),
});

const pence = z.number().int().nonnegative();

/**
 * One lot sale a payout pays, split as its seller-terms snapshot splits it, so the accounts never
 * work the split out again: the hammer, the agreement's commission and the VAT on it, and what the
 * seller receives (hammer - commission - VAT).
 */
export const payoutSettledSaleSchemaV1 = z.object({
  paymentId: z.string().uuid(),
  lotId: z.string().uuid(),
  sellerTermsId: z.string().uuid(),
  agreementId: z.string().uuid(),
  hammerPence: pence,
  commissionBps: z.number().int().min(0).max(10_000),
  commissionPence: pence,
  commissionVatTreatment: z.enum(["standard", "not_registered"]),
  commissionVatBps: z.number().int().min(0).max(10_000),
  commissionVatPence: pence,
  sellerNetPence: pence,
});

/** A sale the run left out because its seller terms are held, with the reason staff fix. */
export const payoutHeldSaleSchemaV1 = z.object({
  paymentId: z.string().uuid(),
  lotId: z.string().uuid().nullable(),
  reason: z.enum([
    "no_agreement",
    "not_accepted",
    "no_commission",
    "other_seller",
    "vat_setting_missing",
    "negative_net",
    "legacy_invoice",
  ]),
});

export const payoutSettlementCreatedPayloadSchemaV1 = z.object({
  legalEntityId: z.string().uuid(),
  grossAmount: z.string(),
  platformFee: z.string(),
  stripeFee: z.string(),
  netAmount: z.string(),
  currency: z.string(),
  paymentLineCount: z.number().int().nonnegative(),
  periodStart: isoDateTime,
  periodEnd: isoDateTime,
  source: z.enum(["admin", "bulk_cron"]),
  /** The hammer, commission and VAT totals of the lot sales on the payout; absent when it has none. */
  hammerAmount: z.string().optional(),
  commissionAmount: z.string().optional(),
  commissionVatAmount: z.string().optional(),
  /** Each lot sale the payout pays, from its snapshot. Absent on events from before snapshots. */
  sales: z.array(payoutSettledSaleSchemaV1).optional(),
  heldSales: z.array(payoutHeldSaleSchemaV1).optional(),
});

/** Xero projector consumes lot.ended — reuse frozen lot schema. */
export { lotEndedPayloadSchema as lotEndedXeroPayloadSchemaV1 };
