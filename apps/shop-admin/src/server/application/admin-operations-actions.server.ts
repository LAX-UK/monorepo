"use server";

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
  return forwardAdminJsonMutation<{ id: string; status: string }>({
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
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "refunds",
    method: "POST",
    jsonBody: {
      orderId: input.orderId,
      amountPence: input.amountPence,
      ...(input.orderLineId ? { orderLineId: input.orderLineId } : {}),
    },
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
