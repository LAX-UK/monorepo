import { z } from "zod";

const rfc3339Timestamp = z.string().datetime({ offset: true });

export const shopProductionStartedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  taskId: z.string().uuid(),
  orderLineId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopFulfilmentDispatchedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  fulfilmentId: z.string().uuid(),
  orderId: z.string().uuid(),
});

export const shopPossessionRecordedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  fulfilmentId: z.string().uuid(),
  orderId: z.string().uuid(),
  possessionAt: rfc3339Timestamp,
});

export const shopRefundRequestedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  refundId: z.string().uuid(),
  orderId: z.string().uuid(),
  amountPence: z.number().int().positive(),
});

export const shopRefundCompletedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  refundId: z.string().uuid(),
  orderId: z.string().uuid(),
  status: z.enum(["succeeded", "failed"]),
});

export const shopCancellationRequestedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  returnId: z.string().uuid(),
  orderLineId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopDisputeOpenedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  disputeId: z.string().uuid(),
  orderId: z.string().uuid(),
  stripeDisputeId: z.string(),
});

export const shopDisputeClosedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  disputeId: z.string().uuid(),
  orderId: z.string().uuid(),
  status: z.enum(["won", "lost", "closed"]),
});

export const shopPayoutPaidPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  payoutId: z.string().uuid(),
  paidReference: z.string(),
});

export const shopStockHoldCreatedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  holdId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopStockHoldReleasedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  holdId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopStockHoldExpiredPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  holdId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopThirdPartySaleRecordedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  saleId: z.string().uuid(),
  editionId: z.string().uuid(),
});

export const shopSaleFeeApprovedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  feeId: z.string().uuid(),
});

export const shopOriginalSaleReservedPayloadSchemaV1 = z.object({
  schemaVersion: z.literal(1),
  originalSaleId: z.string().uuid(),
  artworkId: z.string().uuid(),
});
