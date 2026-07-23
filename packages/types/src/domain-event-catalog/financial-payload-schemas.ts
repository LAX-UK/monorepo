import { z } from "zod";
import { lotEndedPayloadSchema } from "./lot-payload-schemas.js";

const isoDateTime = z.string().datetime();

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
});

/** Xero projector consumes lot.ended — reuse frozen lot schema. */
export { lotEndedPayloadSchema as lotEndedXeroPayloadSchemaV1 };
