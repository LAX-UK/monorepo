"use server";

import { forwardAdminJsonMutation } from "./forward-admin-mutation";

export async function decideSaleAuthorityRequest(input: {
  requestId: string;
  decision: "approve" | "decline";
  authorisedCount?: number;
  evidenceNote?: string;
  declineReason?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation<{ requestId: string; status: string }>({
    bffPath: `sale-authority-requests/${encodeURIComponent(input.requestId)}/decision`,
    method: "POST",
    jsonBody: {
      decision: input.decision,
      ...(input.authorisedCount !== undefined ? { authorisedCount: input.authorisedCount } : {}),
      ...(input.evidenceNote ? { evidenceNote: input.evidenceNote } : {}),
      ...(input.declineReason ? { declineReason: input.declineReason } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function grantStaffRole(input: {
  email: string;
  role: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation({
    bffPath: "staff/grants",
    method: "POST",
    jsonBody: { email: input.email, role: input.role },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function revokeStaffRole(input: {
  identitySubjectId: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation({
    bffPath: `staff/grants/${encodeURIComponent(input.identitySubjectId)}`,
    method: "DELETE",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function grantArtworkSaleAuthority(input: {
  artworkId: string;
  ownerPartyId: string;
  authorisedCount: number;
  evidenceNote: string;
  requestId?: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation({
    bffPath: `artworks/${encodeURIComponent(input.artworkId)}/sale-authority`,
    method: "POST",
    jsonBody: {
      ownerPartyId: input.ownerPartyId,
      authorisedCount: input.authorisedCount,
      evidenceNote: input.evidenceNote,
      ...(input.requestId ? { requestId: input.requestId } : {}),
    },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function linkArtistIdentity(input: {
  artistId: string;
  email: string;
  idempotencyKey?: string;
}) {
  return forwardAdminJsonMutation({
    bffPath: `artists/${encodeURIComponent(input.artistId)}/identity-link`,
    method: "POST",
    jsonBody: { email: input.email },
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}

export async function unlinkArtistIdentity(input: { artistId: string; idempotencyKey?: string }) {
  return forwardAdminJsonMutation({
    bffPath: `artists/${encodeURIComponent(input.artistId)}/identity-link`,
    method: "DELETE",
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  });
}
