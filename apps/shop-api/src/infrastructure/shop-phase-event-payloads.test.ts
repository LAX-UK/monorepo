import {
  guardDomainEventPublish,
  shopCancellationRequestedPayloadSchemaV1,
  shopDisputeClosedPayloadSchemaV1,
  shopDisputeOpenedPayloadSchemaV1,
  shopFulfilmentDispatchedPayloadSchemaV1,
  shopOriginalSaleReservedPayloadSchemaV1,
  shopPayoutPaidPayloadSchemaV1,
  shopPossessionRecordedPayloadSchemaV1,
  shopProductionStartedPayloadSchemaV1,
  shopRefundCompletedPayloadSchemaV1,
  shopRefundRequestedPayloadSchemaV1,
  shopSaleFeeApprovedPayloadSchemaV1,
  shopStockHoldCreatedPayloadSchemaV1,
  shopStockHoldExpiredPayloadSchemaV1,
  shopStockHoldReleasedPayloadSchemaV1,
  shopThirdPartySaleRecordedPayloadSchemaV1,
} from "@auction/types";
import { describe, expect, it } from "vitest";

const sampleUuid = "00000000-0000-4000-8000-000000000001";
const sampleTime = "2026-01-15T12:00:00.000Z";

const phaseEventSamples: Array<{
  eventType: Parameters<typeof guardDomainEventPublish>[1]["eventType"];
  payload: Record<string, unknown> & { schemaVersion: 1 };
  schema: { parse: (value: unknown) => unknown };
}> = [
  {
    eventType: "shop.production.started",
    payload: {
      schemaVersion: 1,
      taskId: sampleUuid,
      orderLineId: sampleUuid,
      editionId: sampleUuid,
    },
    schema: shopProductionStartedPayloadSchemaV1,
  },
  {
    eventType: "shop.fulfilment.dispatched",
    payload: { schemaVersion: 1, fulfilmentId: sampleUuid, orderId: sampleUuid },
    schema: shopFulfilmentDispatchedPayloadSchemaV1,
  },
  {
    eventType: "shop.possession.recorded",
    payload: {
      schemaVersion: 1,
      fulfilmentId: sampleUuid,
      orderId: sampleUuid,
      possessionAt: sampleTime,
    },
    schema: shopPossessionRecordedPayloadSchemaV1,
  },
  {
    eventType: "shop.refund.requested",
    payload: {
      schemaVersion: 1,
      refundId: sampleUuid,
      orderId: sampleUuid,
      amountPence: 100,
    },
    schema: shopRefundRequestedPayloadSchemaV1,
  },
  {
    eventType: "shop.refund.completed",
    payload: {
      schemaVersion: 1,
      refundId: sampleUuid,
      orderId: sampleUuid,
      status: "succeeded",
    },
    schema: shopRefundCompletedPayloadSchemaV1,
  },
  {
    eventType: "shop.cancellation.requested",
    payload: {
      schemaVersion: 1,
      returnId: sampleUuid,
      orderLineId: sampleUuid,
      editionId: sampleUuid,
    },
    schema: shopCancellationRequestedPayloadSchemaV1,
  },
  {
    eventType: "shop.dispute.opened",
    payload: {
      schemaVersion: 1,
      disputeId: sampleUuid,
      orderId: sampleUuid,
      stripeDisputeId: "dp_test",
    },
    schema: shopDisputeOpenedPayloadSchemaV1,
  },
  {
    eventType: "shop.dispute.closed",
    payload: {
      schemaVersion: 1,
      disputeId: sampleUuid,
      orderId: sampleUuid,
      status: "won",
    },
    schema: shopDisputeClosedPayloadSchemaV1,
  },
  {
    eventType: "shop.payout.paid",
    payload: {
      schemaVersion: 1,
      payoutId: sampleUuid,
      paidReference: "BACS-REF",
    },
    schema: shopPayoutPaidPayloadSchemaV1,
  },
  {
    eventType: "shop.stock_hold.created",
    payload: { schemaVersion: 1, holdId: sampleUuid, editionId: sampleUuid },
    schema: shopStockHoldCreatedPayloadSchemaV1,
  },
  {
    eventType: "shop.stock_hold.released",
    payload: { schemaVersion: 1, holdId: sampleUuid, editionId: sampleUuid },
    schema: shopStockHoldReleasedPayloadSchemaV1,
  },
  {
    eventType: "shop.stock_hold.expired",
    payload: { schemaVersion: 1, holdId: sampleUuid, editionId: sampleUuid },
    schema: shopStockHoldExpiredPayloadSchemaV1,
  },
  {
    eventType: "shop.third_party_sale.recorded",
    payload: { schemaVersion: 1, saleId: sampleUuid, editionId: sampleUuid },
    schema: shopThirdPartySaleRecordedPayloadSchemaV1,
  },
  {
    eventType: "shop.sale_fee.approved",
    payload: { schemaVersion: 1, feeId: sampleUuid },
    schema: shopSaleFeeApprovedPayloadSchemaV1,
  },
  {
    eventType: "shop.original_sale.reserved",
    payload: { schemaVersion: 1, originalSaleId: sampleUuid, artworkId: sampleUuid },
    schema: shopOriginalSaleReservedPayloadSchemaV1,
  },
];

describe("Phase 2–4 shop domain event payloads", () => {
  it("pass enforce-mode guardDomainEventPublish for every handler-emitted event shape", () => {
    for (const sample of phaseEventSamples) {
      expect(() => sample.schema.parse(sample.payload)).not.toThrow();
      expect(() =>
        guardDomainEventPublish("enforce", {
          eventType: sample.eventType,
          payload: sample.payload,
          schemaVersion: 1,
        }),
      ).not.toThrow();
    }
  });
});
