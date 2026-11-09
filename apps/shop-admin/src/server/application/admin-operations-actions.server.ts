"use server";

import type { AdminRefundReason } from "@auction/shop-contracts";
import type { ShopReturnDisposition } from "@auction/shop-domain";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

export async function createProductionTask(input: {
  orderLineId: string;
  editionId: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "production/tasks",
    method: "POST",
    jsonBody: { orderLineId: input.orderLineId, editionId: input.editionId },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

/** Moves the work on a frame sold with a print to its next step. */
export async function updateFramingTask(input: {
  taskId: string;
  status: string;
  expectedVersion: number;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ taskId: string; status: string; version: number }>({
    bffPath: `framing-tasks/${encodeURIComponent(input.taskId)}`,
    method: "PUT",
    jsonBody: { status: input.status, expectedVersion: input.expectedVersion },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function updateFulfilment(input: {
  fulfilmentId: string;
  status: string;
  carrier?: string;
  trackingNumber?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "fulfilment",
    method: "PATCH",
    jsonBody: {
      fulfilmentId: input.fulfilmentId,
      status: input.status,
      ...(input.carrier !== undefined ? { carrier: input.carrier } : {}),
      ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function recordFulfilmentPossession(input: {
  fulfilmentId: string;
  status: string;
  possessionAt: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "fulfilment/possession",
    method: "POST",
    jsonBody: {
      fulfilmentId: input.fulfilmentId,
      status: input.status,
      possessionAt: input.possessionAt,
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function cancelOrderAfterPossession(input: {
  orderLineId: string;
  editionId: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string; framingRefundPence?: number }>({
    bffPath: "cancellations",
    method: "POST",
    jsonBody: { orderLineId: input.orderLineId, editionId: input.editionId },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function requestOrderRefund(input: {
  orderId: string;
  amountPence: number;
  orderLineId?: string;
  reason?: AdminRefundReason;
  note?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string; framingRefundPence?: number }>({
    bffPath: "refunds",
    method: "POST",
    jsonBody: {
      orderId: input.orderId,
      amountPence: input.amountPence,
      ...(input.orderLineId ? { orderLineId: input.orderLineId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.note ? { note: input.note } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function retryOrderRefund(input: { refundId: string; idempotencyKey?: string }) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "refunds/retry",
    method: "POST",
    jsonBody: { refundId: input.refundId },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function settleRefundOutsideLax(input: {
  refundId: string;
  reason: string;
  externalReference: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "refunds/settled-outside",
    method: "POST",
    jsonBody: {
      refundId: input.refundId,
      reason: input.reason,
      externalReference: input.externalReference,
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function markReturnInTransit(input: { returnId: string; idempotencyKey?: string }) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: `returns/${encodeURIComponent(input.returnId)}/in-transit`,
    method: "POST",
    jsonBody: {},
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function receiveReturn(input: {
  returnId: string;
  disposition: ShopReturnDisposition;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: `returns/${encodeURIComponent(input.returnId)}/receive`,
    method: "POST",
    jsonBody: { disposition: input.disposition },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function markPayoutPaid(input: {
  payoutId: string;
  paidReference: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "payouts/mark-paid",
    method: "POST",
    jsonBody: { payoutId: input.payoutId, paidReference: input.paidReference },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
