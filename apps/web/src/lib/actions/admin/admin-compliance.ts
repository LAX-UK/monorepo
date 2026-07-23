"use server";

import { complianceErrorMessage } from "@/lib/admin/compliance-error-messages";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { getWriteContainer } from "@/lib/data/write-container.server";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

const amlTriageInput = z.object({
  screeningId: z.string().trim().min(1),
  recommendation: z.enum(["clear", "block"]),
  notes: z.string().trim().max(2000).optional(),
});

const amlDecideInput = z.object({
  screeningId: z.string().trim().min(1),
  decision: z.enum(["clear", "block"]),
  notes: z.string().trim().max(2000).optional(),
});

const sofTriageInput = z.object({
  caseId: z.string().trim().min(1),
  recommendation: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2000).optional(),
});

const sofDecideInput = z.object({
  caseId: z.string().trim().min(1),
  decision: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2000).optional(),
});

const sofReopenInput = z.object({
  caseId: z.string().trim().min(1),
});

export async function amlTriageAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("amlTriageAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied) return denied;

    const parsed = amlTriageInput.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid triage form");
    }

    const { screeningId, recommendation, notes } = parsed.data;
    const res = await getWriteContainer().adminCompliance.amlTriage(
      screeningId,
      recommendation,
      notes || undefined,
    );
    if (!res.ok) {
      return actionFailure(serviceErrorMessage(res.body, "Triage failed", res.status));
    }

    revalidatePath("/admin/compliance/aml");
    revalidatePath("/admin");
    return actionSuccess();
  });
}

export async function amlDecideAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("amlDecideAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied) return denied;

    const parsed = amlDecideInput.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid decision form");
    }

    const { screeningId, decision, notes } = parsed.data;
    const res = await getWriteContainer().adminCompliance.amlDecide(
      screeningId,
      decision,
      notes || undefined,
    );
    if (!res.ok) {
      return actionFailure(serviceErrorMessage(res.body, "Decision failed", res.status));
    }

    revalidatePath("/admin/compliance/aml");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return actionSuccess();
  });
}

export async function sofTriageAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("sofTriageAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied) return denied;

    const parsed = sofTriageInput.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid triage form");
    }

    const { caseId, recommendation, notes } = parsed.data;
    const res = await getWriteContainer().adminCompliance.sofTriage(
      caseId,
      recommendation,
      notes || undefined,
    );
    if (!res.ok) {
      return actionFailure(serviceErrorMessage(res.body, "Triage failed", res.status));
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin");
    return actionSuccess();
  });
}

export async function sofDecideAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("sofDecideAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied) return denied;

    const parsed = sofDecideInput.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Invalid decision form");
    }

    const { caseId, decision, notes } = parsed.data;
    const res = await getWriteContainer().adminCompliance.sofDecide(
      caseId,
      decision,
      notes || undefined,
    );
    if (!res.ok) {
      return actionFailure(serviceErrorMessage(res.body, "Decision failed", res.status));
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return actionSuccess();
  });
}

export async function sofReopenAction(input: unknown): Promise<ActionResult<void>> {
  return instrumentServerAction("sofReopenAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied) return denied;

    const parsed = sofReopenInput.safeParse(input);
    if (!parsed.success) {
      return actionFailure("Case id is required");
    }

    const { caseId } = parsed.data;
    const res = await getWriteContainer().adminCompliance.sofReopen(caseId);
    if (!res.ok) {
      return actionFailure(serviceErrorMessage(res.body, "Reopen failed", res.status));
    }

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath(`/admin/compliance/source-of-funds/${caseId}`);
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    return actionSuccess();
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
