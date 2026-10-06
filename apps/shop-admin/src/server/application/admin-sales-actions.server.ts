"use server";

import { forwardAdminJsonMutation } from "./forward-admin-mutation";

export async function createStockHold(input: {
  editionId: string;
  clientPartyId: string;
  expiresAt: string;
  note?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "holds",
    method: "POST",
    jsonBody: {
      editionId: input.editionId,
      clientPartyId: input.clientPartyId,
      expiresAt: input.expiresAt,
      ...(input.note ? { note: input.note } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function releaseStockHold(input: { holdId: string; idempotencyKey?: string }) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: `holds/${encodeURIComponent(input.holdId)}/release`,
    method: "POST",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function recordThirdPartySale(input: {
  editionId: string;
  sellerPartyId: string;
  buyerPartyId: string;
  grossPence: number;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "third-party-sales",
    method: "POST",
    jsonBody: {
      editionId: input.editionId,
      sellerPartyId: input.sellerPartyId,
      buyerPartyId: input.buyerPartyId,
      grossPence: input.grossPence,
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function approveSaleFee(input: { feeId: string; idempotencyKey?: string }) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: `sale-fees/${encodeURIComponent(input.feeId)}/approve`,
    method: "POST",
    jsonBody: { feeId: input.feeId },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function createOriginalSale(input: {
  artworkId: string;
  buyerPartyId: string;
  salePricePence: number;
  reservationExpiresAt?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ id: string; status: string }>({
    bffPath: "original-sales",
    method: "POST",
    jsonBody: {
      artworkId: input.artworkId,
      buyerPartyId: input.buyerPartyId,
      salePricePence: input.salePricePence,
      ...(input.reservationExpiresAt ? { reservationExpiresAt: input.reservationExpiresAt } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
