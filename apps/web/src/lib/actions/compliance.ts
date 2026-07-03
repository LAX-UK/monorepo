"use server";

import { complianceErrorMessage } from "@/lib/admin/compliance-error-messages";
import {
  type SofListStatus,
  buildSofCaseDetailHref,
  buildSofListHref,
} from "@/lib/admin/sof-list-query";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function serviceErrorMessage(body: unknown, fallback: string, status: number): string {
  try {
    const raw = normalizeApiErrorMessage(
      body && typeof body === "object" && "error" in body
        ? (body as { error?: unknown }).error
        : body,
      fallback,
    );
    return complianceErrorMessage(raw);
  } catch {
    return `${fallback} (${status})`;
  }
}

function redirectAml(success?: string, error?: string): never {
  const params = new URLSearchParams();
  if (success) params.set("success", success);
  if (error) params.set("error", error);
  const q = params.toString();
  redirect(q ? `/admin/compliance/aml?${q}` : "/admin/compliance/aml");
}

function redirectSof(
  success?: string,
  error?: string,
  caseId?: string,
  listStatus: SofListStatus = "pending",
): never {
  const params = new URLSearchParams();
  if (success) params.set("success", success);
  if (error) params.set("error", error);
  const extra = params.toString();

  if (caseId) {
    const base = buildSofCaseDetailHref(caseId, listStatus);
    redirect(extra ? `${base}&${extra}` : base);
  }
  const listBase = buildSofListHref(listStatus);
  redirect(extra ? `${listBase}&${extra}` : listBase);
}

export async function amlTriageAction(formData: FormData): Promise<void> {
  return instrumentServerAction("amlTriageAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) redirectAml(undefined, denied.error);

    const screeningId = String(formData.get("screeningId") ?? "").trim();
    const recommendation = String(formData.get("recommendation") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!screeningId || (recommendation !== "clear" && recommendation !== "block")) {
      redirectAml(undefined, "Invalid triage form");
    }

    const res = await getWriteContainer().adminCompliance.amlTriage(
      screeningId,
      recommendation as "clear" | "block",
      notes || undefined,
    );
    if (!res.ok) {
      redirectAml(undefined, serviceErrorMessage(res.body, "Triage failed", res.status));
    }

    revalidatePath("/admin/compliance/aml");
    revalidatePath("/admin");
    redirectAml("Triage recorded — awaiting MLRO decision");
  });
}

export async function amlDecideAction(formData: FormData): Promise<void> {
  return instrumentServerAction("amlDecideAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied && !denied.ok) redirectAml(undefined, denied.error);

    const screeningId = String(formData.get("screeningId") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!screeningId || (decision !== "clear" && decision !== "block")) {
      redirectAml(undefined, "Invalid decision form");
    }

    const res = await getWriteContainer().adminCompliance.amlDecide(
      screeningId,
      decision as "clear" | "block",
      notes || undefined,
    );
    if (!res.ok) {
      redirectAml(undefined, serviceErrorMessage(res.body, "Decision failed", res.status));
    }

    revalidatePath("/admin/compliance/aml");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    redirectAml(decision === "clear" ? "Screening cleared — hold lifted" : "Screening blocked");
  });
}

export async function sofTriageAction(formData: FormData): Promise<void> {
  return instrumentServerAction("sofTriageAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) redirectSof(undefined, denied.error);

    const caseId = String(formData.get("caseId") ?? "").trim();
    const recommendation = String(formData.get("recommendation") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!caseId || (recommendation !== "approve" && recommendation !== "reject")) {
      redirectSof(undefined, "Invalid triage form");
    }

    const res = await getWriteContainer().adminCompliance.sofTriage(
      caseId,
      recommendation as "approve" | "reject",
      notes || undefined,
    );
    if (!res.ok) {
      redirectSof(undefined, serviceErrorMessage(res.body, "Triage failed", res.status), caseId);
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin");
    redirectSof("Triage recorded — awaiting MLRO decision", undefined, caseId);
  });
}

export async function sofDecideAction(formData: FormData): Promise<void> {
  return instrumentServerAction("sofDecideAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied && !denied.ok) redirectSof(undefined, denied.error);

    const caseId = String(formData.get("caseId") ?? "").trim();
    const decision = String(formData.get("decision") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    if (!caseId || (decision !== "approve" && decision !== "reject")) {
      redirectSof(undefined, "Invalid decision form");
    }

    const res = await getWriteContainer().adminCompliance.sofDecide(
      caseId,
      decision as "approve" | "reject",
      notes || undefined,
    );
    if (!res.ok) {
      redirectSof(undefined, serviceErrorMessage(res.body, "Decision failed", res.status), caseId);
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    redirectSof(
      decision === "approve" ? "Source of Funds approved" : "Source of Funds rejected",
      undefined,
      caseId,
      decision === "approve" ? "approved" : "rejected",
    );
  });
}

export async function sofReopenAction(formData: FormData): Promise<void> {
  return instrumentServerAction("sofReopenAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied && !denied.ok) redirectSof(undefined, denied.error);

    const caseId = String(formData.get("caseId") ?? "").trim();
    if (!caseId) redirectSof(undefined, "Case id is required");

    const res = await getWriteContainer().adminCompliance.sofReopen(caseId);
    if (!res.ok) {
      redirectSof(undefined, serviceErrorMessage(res.body, "Reopen failed", res.status), caseId);
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    redirectSof("Rejected case reopened for review", undefined, caseId);
  });
}

export type SofDocumentDownloadResult = { ok: true; url: string } | { ok: false; error: string };

export type SofBulkDownloadResult =
  | { ok: true; data: ArrayBuffer; fileName: string }
  | { ok: false; error: string };

/** Resolve a short-TTL, audited download URL for a buyer-submitted SoF document.
 * The API emits a `source_of_funds.document_downloaded` audit event (actor + IP)
 * on every call, so staff downloads are never served from a long-lived link. */
export async function downloadSofDocumentAction(
  caseId: string,
  documentId: string,
): Promise<SofDocumentDownloadResult> {
  return instrumentServerAction("downloadSofDocumentAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false as const, error: denied.error };
    }

    const id = caseId.trim();
    const docId = documentId.trim();
    if (!id || !docId) {
      return { ok: false as const, error: "Document id is required" };
    }

    const res = await getWriteContainer().adminCompliance.downloadSofDocument(id, docId);
    if (!res.ok) {
      return {
        ok: false as const,
        error: serviceErrorMessage(res.body, "Download failed", res.status),
      };
    }
    return { ok: true as const, url: res.data.url };
  });
}

/** Download all active SoF documents for a case as a zip archive (audited per file). */
export async function downloadAllSofDocumentsAction(
  caseId: string,
): Promise<SofBulkDownloadResult> {
  return instrumentServerAction("downloadAllSofDocumentsAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false as const, error: denied.error };
    }

    const id = caseId.trim();
    if (!id) {
      return { ok: false as const, error: "Case id is required" };
    }

    const res = await getWriteContainer().adminCompliance.downloadAllSofDocuments(id);
    if (!res.ok) {
      return {
        ok: false as const,
        error: serviceErrorMessage(res.body, "Download failed", res.status),
      };
    }
    return { ok: true as const, data: res.data.data, fileName: res.data.fileName };
  });
}

export type RequestSofDocumentsResult = { ok: true } | { ok: false; error: string };

export async function requestSofDocumentsAction(
  formData: FormData,
): Promise<RequestSofDocumentsResult> {
  return instrumentServerAction("requestSofDocumentsAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false as const, error: denied.error };
    }

    const caseId = String(formData.get("caseId") ?? "").trim();
    const typesRaw = String(formData.get("documentTypes") ?? "[]");
    const note = String(formData.get("note") ?? "").trim();
    let documentTypes: string[] = [];
    try {
      const parsed = JSON.parse(typesRaw) as unknown;
      documentTypes = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return { ok: false as const, error: "Invalid document types" };
    }
    if (!caseId || documentTypes.length === 0) {
      return { ok: false as const, error: "Case and at least one document type required" };
    }

    const res = await getWriteContainer().adminCompliance.requestSofDocuments(
      caseId,
      documentTypes,
      note || undefined,
    );
    if (!res.ok) {
      return {
        ok: false as const,
        error: serviceErrorMessage(res.body, "Request failed", res.status),
      };
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    return { ok: true as const };
  });
}

export type ReviewSofDocumentResult = { ok: true } | { ok: false; error: string };

export async function reviewSofDocumentAction(
  caseId: string,
  documentId: string,
  checks: {
    matchesDeclaredSource?: boolean;
    coversExposure?: boolean;
    recentEnough?: boolean;
    legibleComplete?: boolean;
  },
  note: string,
): Promise<ReviewSofDocumentResult> {
  return instrumentServerAction("reviewSofDocumentAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false as const, error: denied.error };
    }

    const id = caseId.trim();
    const docId = documentId.trim();
    if (!id || !docId) {
      return { ok: false as const, error: "Document id is required" };
    }

    const res = await getWriteContainer().adminCompliance.reviewSofDocument(
      id,
      docId,
      checks,
      note,
    );
    if (!res.ok) {
      return {
        ok: false as const,
        error: serviceErrorMessage(res.body, "Review save failed", res.status),
      };
    }

    revalidatePath(`/admin/compliance/source-of-funds/${id}`);
    revalidatePath("/admin/compliance/source-of-funds");
    return { ok: true as const };
  });
}
