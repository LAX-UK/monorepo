"use server";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import type { EntityDocument } from "@auction/types";
import { revalidatePath } from "next/cache";

type AttachPayload = {
  uploadObjectId: string;
  kind: string;
  label: string | null;
};

export async function adminAttachSaleDocumentResultAction(
  saleId: string,
  input: AttachPayload,
): Promise<ActionResult<EntityDocument>> {
  const res = await authedServerFetch(`/sales/${saleId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    skipActingLegalEntityHeader: true,
  });
  const payload = (await res.json().catch(() => ({}))) as { data?: EntityDocument; error?: string };
  if (!res.ok) return actionFailure(payload.error ?? "attach_failed");
  if (!payload.data) return actionFailure("invalid_response");
  revalidatePath(`/admin/sales/${saleId}/edit`);
  revalidatePath(`/admin/sales/${saleId}`);
  return actionSuccess(payload.data);
}

export async function adminRemoveSaleDocumentResultAction(
  saleId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(`/sales/${saleId}/documents/${documentId}`, {
    method: "DELETE",
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(body.error ?? "remove_failed");
  }
  revalidatePath(`/admin/sales/${saleId}/edit`);
  revalidatePath(`/admin/sales/${saleId}`);
  return actionSuccess(undefined);
}

function revalidateAdminLotEdit(lotId: string) {
  revalidatePath(`/admin/lots/${lotId}/edit`);
  revalidatePath(`/admin/lots/${lotId}/edit/catalog`);
  revalidatePath(`/admin/lots/${lotId}/edit/documents`);
  revalidatePath(`/admin/lots/${lotId}`);
  revalidatePath(`/admin/lots/${lotId}/documents`);
}

export async function adminAttachLotDocumentResultAction(
  lotId: string,
  input: AttachPayload,
): Promise<ActionResult<EntityDocument>> {
  const res = await authedServerFetch(`/lots/${lotId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    skipActingLegalEntityHeader: true,
  });
  const payload = (await res.json().catch(() => ({}))) as { data?: EntityDocument; error?: string };
  if (!res.ok) return actionFailure(payload.error ?? "attach_failed");
  if (!payload.data) return actionFailure("invalid_response");
  revalidateAdminLotEdit(lotId);
  return actionSuccess(payload.data);
}

export async function adminRemoveLotDocumentResultAction(
  lotId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(`/lots/${lotId}/documents/${documentId}`, {
    method: "DELETE",
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(body.error ?? "remove_failed");
  }
  revalidateAdminLotEdit(lotId);
  return actionSuccess(undefined);
}

export async function adminAttachSubmissionDocumentResultAction(
  submissionId: string,
  input: AttachPayload,
): Promise<ActionResult<EntityDocument>> {
  const res = await authedServerFetch(`/submissions/${submissionId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    skipActingLegalEntityHeader: true,
  });
  const payload = (await res.json().catch(() => ({}))) as { data?: EntityDocument; error?: string };
  if (!res.ok) return actionFailure(payload.error ?? "attach_failed");
  if (!payload.data) return actionFailure("invalid_response");
  revalidatePath(`/admin/submissions/${submissionId}`);
  return actionSuccess(payload.data);
}

export async function adminRemoveSubmissionDocumentResultAction(
  submissionId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  const res = await authedServerFetch(`/submissions/${submissionId}/documents/${documentId}`, {
    method: "DELETE",
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return actionFailure(body.error ?? "remove_failed");
  }
  revalidatePath(`/admin/submissions/${submissionId}`);
  return actionSuccess(undefined);
}
