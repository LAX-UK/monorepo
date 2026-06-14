"use server";

import { complianceErrorMessage } from "@/lib/admin/compliance-error-messages";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type AdminSourceOfFundsDetail,
  getAdminSourceOfFundsDetail,
} from "@/lib/data/http/compliance.server";
import { AML_REVIEW_ACCESS, MLRO_DECISION_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import { normalizeApiErrorMessage } from "@auction/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function apiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    const raw = normalizeApiErrorMessage(body.error, fallback);
    return complianceErrorMessage(raw);
  } catch {
    return `${fallback} (${res.status})`;
  }
}

function redirectAml(success?: string, error?: string): never {
  const params = new URLSearchParams();
  if (success) params.set("success", success);
  if (error) params.set("error", error);
  const q = params.toString();
  redirect(q ? `/admin/compliance/aml?${q}` : "/admin/compliance/aml");
}

function redirectSof(success?: string, error?: string): never {
  const params = new URLSearchParams();
  if (success) params.set("success", success);
  if (error) params.set("error", error);
  const q = params.toString();
  redirect(q ? `/admin/compliance/source-of-funds?${q}` : "/admin/compliance/source-of-funds");
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

    const res = await authedServerFetch(
      `/admin/compliance/aml/screenings/${encodeURIComponent(screeningId)}/triage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation, notes: notes || undefined }),
      },
    );
    if (!res.ok) redirectAml(undefined, await apiError(res, "Triage failed"));

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

    const res = await authedServerFetch(
      `/admin/compliance/aml/screenings/${encodeURIComponent(screeningId)}/decide`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes || undefined }),
      },
    );
    if (!res.ok) redirectAml(undefined, await apiError(res, "Decision failed"));

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

    const res = await authedServerFetch(
      `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/triage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendation, notes: notes || undefined }),
      },
    );
    if (!res.ok) redirectSof(undefined, await apiError(res, "Triage failed"));

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath("/admin");
    redirectSof("Triage recorded — awaiting MLRO decision");
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

    const res = await authedServerFetch(
      `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/decide`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notes || undefined }),
      },
    );
    if (!res.ok) redirectSof(undefined, await apiError(res, "Decision failed"));

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    redirectSof(decision === "approve" ? "Source of Funds approved" : "Source of Funds rejected");
  });
}

export async function sofReopenAction(formData: FormData): Promise<void> {
  return instrumentServerAction("sofReopenAction", async () => {
    const denied = await denyUnlessAdminCapability(MLRO_DECISION_ACCESS);
    if (denied && !denied.ok) redirectSof(undefined, denied.error);

    const caseId = String(formData.get("caseId") ?? "").trim();
    if (!caseId) redirectSof(undefined, "Case id is required");

    const res = await authedServerFetch(
      `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/reopen`,
      { method: "POST" },
    );
    if (!res.ok) redirectSof(undefined, await apiError(res, "Reopen failed"));

    revalidatePath("/admin/compliance/source-of-funds");
    revalidatePath("/admin/payments");
    revalidatePath("/admin");
    redirectSof("Rejected case reopened for review");
  });
}

export type FetchAdminSofCaseDetailResult =
  | { ok: true; data: AdminSourceOfFundsDetail }
  | { ok: false; error: string };

/** Read-only detail fetch for the SoF review drawer (no redirect). */
export async function fetchAdminSofCaseDetailAction(
  caseId: string,
): Promise<FetchAdminSofCaseDetailResult> {
  return instrumentServerAction("fetchAdminSofCaseDetailAction", async () => {
    const denied = await denyUnlessAdminCapability(AML_REVIEW_ACCESS);
    if (denied && !denied.ok) {
      return { ok: false as const, error: denied.error };
    }

    const id = caseId.trim();
    if (!id) {
      return { ok: false as const, error: "Case id is required" };
    }

    try {
      const data = await getAdminSourceOfFundsDetail(id);
      if (!data) {
        return { ok: false as const, error: "Source of Funds case not found" };
      }
      return { ok: true as const, data };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Could not load case detail",
      };
    }
  });
}
