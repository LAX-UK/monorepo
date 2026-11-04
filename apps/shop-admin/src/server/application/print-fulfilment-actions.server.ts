"use server";

import type {
  AdminConfirmPrintBody,
  AdminConfirmPrintResponse,
  AdminHorsCommerceApprovalResponse,
  AdminSwapPrintBody,
  AdminSwapPrintResponse,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for packing: confirm the print in hand against an order line, send another
 * print in its place, mark a certificate sent, record the artist's written authority and approve
 * a hors commerce proof for sale. Each forwards to shop-api, which applies the rules again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid packing request.",
} as const satisfies AdminMutationResult<never>;

export async function confirmPrint(input: {
  orderLineId: string;
  body: AdminConfirmPrintBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminConfirmPrintResponse>> {
  if (!UUID.test(input.orderLineId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `order-lines/${input.orderLineId}/confirm-print`,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function swapPrint(input: {
  orderLineId: string;
  body: AdminSwapPrintBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminSwapPrintResponse>> {
  if (!UUID.test(input.orderLineId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `order-lines/${input.orderLineId}/swap-print`,
    method: "POST",
    jsonBody: input.body,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function markCertificateSent(input: {
  certificateId: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ issuedAt: string }>> {
  if (!UUID.test(input.certificateId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `certificates/${input.certificateId}/mark-sent`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function recordCertificateAuthority(input: {
  artworkId: string;
  reference: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ recordedAt: string }>> {
  if (!UUID.test(input.artworkId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `artworks/${input.artworkId}/certificate-authority`,
    method: "PUT",
    jsonBody: { reference: input.reference },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function approveHorsCommerce(input: {
  artworkId: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminHorsCommerceApprovalResponse>> {
  if (!UUID.test(input.artworkId)) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: `artworks/${input.artworkId}/hors-commerce-approval`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}
