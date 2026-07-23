import type { XeroProjectorOperation } from "./xero-projector-config.js";

export type XeroProjectorCommand = {
  operation: XeroProjectorOperation;
  aggregateId: string;
  eventId: number;
  eventType: string;
  idempotencyKey: string;
  summary: Record<string, string | number | boolean | null>;
};

type XeroDomainEventRow = {
  id: number;
  eventType: string;
  aggregateId: string;
  payload: unknown;
};

function operationForEventType(eventType: string): XeroProjectorOperation | null {
  switch (eventType) {
    case "payment.captured":
      return "payment_captured";
    case "payment.refunded":
      return "payment_refunded";
    case "lot.ended":
      return "lot_invoice";
    case "payout.paid":
      return "payout_bill";
    case "payout.settlement_created":
      return "payout_settlement";
    default:
      return null;
  }
}

function buildCommand(
  event: XeroDomainEventRow,
  operation: XeroProjectorOperation,
): XeroProjectorCommand {
  return {
    operation,
    aggregateId: event.aggregateId,
    eventId: event.id,
    eventType: event.eventType,
    idempotencyKey: `xero:${operation}:${event.id}`,
    summary: {
      aggregateId: event.aggregateId,
      eventType: event.eventType,
    },
  };
}

export function buildXeroCommandFromEvent(event: XeroDomainEventRow): XeroProjectorCommand | null {
  const operation = operationForEventType(event.eventType);
  if (!operation) return null;
  return buildCommand(event, operation);
}

/** Commands produced by the pre–Phase-2 cursor-only Xero projector (payout bills only). */
export function buildLegacyXeroCommandFromEvent(
  event: XeroDomainEventRow,
): XeroProjectorCommand | null {
  if (event.eventType !== "payout.paid") return null;
  return buildCommand(event, "payout_bill");
}

export function diffXeroShadowCommand(
  projected: XeroProjectorCommand,
  legacy?: XeroProjectorCommand | null,
): { equal: boolean; diff: Record<string, unknown> } {
  if (!legacy) {
    return { equal: false, diff: { legacy: null, projected } };
  }
  const equal =
    projected.operation === legacy.operation &&
    projected.aggregateId === legacy.aggregateId &&
    projected.idempotencyKey === legacy.idempotencyKey;
  return {
    equal,
    diff: {
      projected,
      legacy,
    },
  };
}
