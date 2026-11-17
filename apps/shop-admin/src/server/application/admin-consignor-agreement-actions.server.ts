"use server";

import type {
  AdminConsignorAgreement,
  AdminConsignorAgreementCreateBody,
  AdminConsignorAgreementFileLink,
  AdminConsignorAgreementFileUpload,
} from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

/*
 * LAX Admin's calls for a consignor's agreements on their client page. Adding, replacing and
 * retiring need a recent sign-in; uploading the signed file does not, since it changes nothing
 * until an agreement names it. shop-api checks the capability, the client and every rule again.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = {
  ok: false,
  kind: "validation",
  message: "Invalid agreement request.",
} as const satisfies AdminMutationResult<never>;

const agreementsPath = (partyId: string) => `clients/${partyId}/consignor-agreements`;

/** Where to PUT the signed file; the key goes in the add or replace body. */
export async function requestAgreementFileUpload(input: {
  partyId: string;
  contentType: string;
  byteSize: number;
}): Promise<AdminMutationResult<AdminConsignorAgreementFileUpload>> {
  if (!UUID.test(input.partyId)) return invalid;
  return forwardAdminJsonMutation<AdminConsignorAgreementFileUpload>({
    bffPath: `clients/${input.partyId}/consignor-agreement-uploads`,
    method: "POST",
    jsonBody: { contentType: input.contentType, byteSize: input.byteSize },
  });
}

export async function addConsignorAgreement(input: {
  partyId: string;
  terms: AdminConsignorAgreementCreateBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminConsignorAgreement>> {
  if (!UUID.test(input.partyId)) return invalid;
  return forwardAdminJsonMutation<AdminConsignorAgreement>({
    bffPath: agreementsPath(input.partyId),
    method: "POST",
    jsonBody: input.terms,
    idempotencyKey: input.idempotencyKey,
  });
}

/** Adds the next version with these terms, against the version staff were looking at. */
export async function replaceConsignorAgreement(input: {
  partyId: string;
  agreementId: string;
  expectedVersion: number;
  terms: AdminConsignorAgreementCreateBody;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminConsignorAgreement>> {
  if (!UUID.test(input.partyId) || !UUID.test(input.agreementId)) return invalid;
  return forwardAdminJsonMutation<AdminConsignorAgreement>({
    bffPath: `${agreementsPath(input.partyId)}/${input.agreementId}/replace`,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion, ...input.terms },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function retireConsignorAgreement(input: {
  partyId: string;
  agreementId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminConsignorAgreement>> {
  if (!UUID.test(input.partyId) || !UUID.test(input.agreementId)) return invalid;
  return forwardAdminJsonMutation<AdminConsignorAgreement>({
    bffPath: `${agreementsPath(input.partyId)}/${input.agreementId}/retire`,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

/** A link to download one version's signed file, valid for a few minutes. */
export async function agreementFileLink(input: {
  partyId: string;
  versionId: string;
}): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  if (!UUID.test(input.partyId) || !UUID.test(input.versionId)) {
    return { ok: false, message: "Invalid agreement request." };
  }
  const result = await fetchAdminJson<AdminConsignorAgreementFileLink>(
    `${agreementsPath(input.partyId)}/versions/${input.versionId}/file`,
  );
  if (result.status === "ok") return { ok: true, url: result.data.url };
  return {
    ok: false,
    message:
      result.status === "forbidden"
        ? "You cannot open this agreement's file."
        : "The signed file could not be opened. Try again in a moment.",
  };
}
