"use server";

import { readApiActionErrorMeta } from "@/lib/actions/_utils";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { LOTS_ACCESS, SALES_ACCESS, SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { EntityDocument } from "@auction/types";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";

type AttachPayload = {
  uploadObjectId: string;
  kind: string;
  label: string | null;
};

function serviceAttachFailure(
  body: unknown,
  _message: string,
  status: number,
  code?: string,
): ActionResult<never> {
  const err =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : undefined;
  const meta = readApiActionErrorMeta(body);
  return actionFailure(
    normalizeApiErrorMessage(err, "attach_failed"),
    undefined,
    status,
    code,
    meta,
  );
}

function serviceRemoveFailure(
  body: unknown,
  _message: string,
  status: number,
  code?: string,
): ActionResult<never> {
  const err =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: unknown }).error
      : undefined;
  const meta = readApiActionErrorMeta(body);
  return actionFailure(
    normalizeApiErrorMessage(err, "remove_failed"),
    undefined,
    status,
    code,
    meta,
  );
}

export async function adminAttachSaleDocumentResultAction(
  saleId: string,
  input: AttachPayload,
): Promise<ActionResult<EntityDocument>> {
  return instrumentServerAction("adminAttachSaleDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.attachSaleDocument(saleId, input);
    if (!res.ok) {
      return serviceAttachFailure(res.body, res.message, res.status, res.code);
    }
    revalidatePath(`/admin/sales/${saleId}/edit`);
    revalidatePath(`/admin/sales/${saleId}`);
    return actionSuccess(res.data);
  });
}

export async function adminRemoveSaleDocumentResultAction(
  saleId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRemoveSaleDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SALES_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.removeSaleDocument(saleId, documentId);
    if (!res.ok) {
      return serviceRemoveFailure(res.body, res.message, res.status, res.code);
    }
    revalidatePath(`/admin/sales/${saleId}/edit`);
    revalidatePath(`/admin/sales/${saleId}`);
    return actionSuccess(undefined);
  });
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
  return instrumentServerAction("adminAttachLotDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.attachLotDocument(lotId, input);
    if (!res.ok) {
      return serviceAttachFailure(res.body, res.message, res.status, res.code);
    }
    revalidateAdminLotEdit(lotId);
    return actionSuccess(res.data);
  });
}

export async function adminRemoveLotDocumentResultAction(
  lotId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRemoveLotDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(LOTS_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.removeLotDocument(lotId, documentId);
    if (!res.ok) {
      return serviceRemoveFailure(res.body, res.message, res.status, res.code);
    }
    revalidateAdminLotEdit(lotId);
    return actionSuccess(undefined);
  });
}

export async function adminAttachSubmissionDocumentResultAction(
  submissionId: string,
  input: AttachPayload,
): Promise<ActionResult<EntityDocument>> {
  return instrumentServerAction("adminAttachSubmissionDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.attachSubmissionDocument(
      submissionId,
      input,
    );
    if (!res.ok) {
      return serviceAttachFailure(res.body, res.message, res.status, res.code);
    }
    revalidatePath(`/admin/submissions/${submissionId}`);
    return actionSuccess(res.data);
  });
}

export async function adminRemoveSubmissionDocumentResultAction(
  submissionId: string,
  documentId: string,
): Promise<ActionResult<void>> {
  return instrumentServerAction("adminRemoveSubmissionDocumentResultAction", async () => {
    const denied = await denyUnlessAdminCapability(SUBMISSIONS_ACCESS);
    if (denied) return denied;
    const res = await getWriteContainer().adminDocuments.removeSubmissionDocument(
      submissionId,
      documentId,
    );
    if (!res.ok) {
      return serviceRemoveFailure(res.body, res.message, res.status, res.code);
    }
    revalidatePath(`/admin/submissions/${submissionId}`);
    return actionSuccess(undefined);
  });
}
