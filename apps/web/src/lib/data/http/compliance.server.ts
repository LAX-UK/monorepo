import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { normalizeApiErrorMessage } from "@auction/validators";

export type AdminAmlScreeningRow = {
  id: string;
  userId: string;
  providerSessionId: string;
  matchStatus: string;
  monitorStatus: string;
  totalHits: number;
  categories: string[];
  decisionOutcome: string;
  reviewStatus: string;
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triagedAt: string | null;
  triageNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  screenedAt: string;
  createdAt: string;
};

export type AdminSourceOfFundsRow = {
  id: string;
  userId: string;
  status: string;
  trigger: string;
  thresholdAmount: string;
  exposureAmount: string;
  currency: string;
  declaredSource: string | null;
  evidence: string[];
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triagedAt: string | null;
  triageNotes: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function screeningFromJson(raw: unknown): AdminAmlScreeningRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  const userId = str(o.userId);
  if (!id || !userId) return null;
  const categories = Array.isArray(o.categories)
    ? o.categories.map((c) => String(c))
    : typeof o.categories === "string"
      ? o.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : [];
  return {
    id,
    userId,
    providerSessionId: str(o.providerSessionId),
    matchStatus: str(o.matchStatus),
    monitorStatus: str(o.monitorStatus),
    totalHits: Number(o.totalHits ?? 0),
    categories,
    decisionOutcome: str(o.decisionOutcome),
    reviewStatus: str(o.reviewStatus),
    triageRecommendation: o.triageRecommendation == null ? null : str(o.triageRecommendation),
    triagedByUserId: o.triagedByUserId == null ? null : str(o.triagedByUserId),
    triagedAt: o.triagedAt == null ? null : String(o.triagedAt),
    triageNotes: o.triageNotes == null ? null : str(o.triageNotes),
    reviewedByUserId: o.reviewedByUserId == null ? null : str(o.reviewedByUserId),
    reviewedAt: o.reviewedAt == null ? null : String(o.reviewedAt),
    reviewNotes: o.reviewNotes == null ? null : str(o.reviewNotes),
    screenedAt: String(o.screenedAt ?? ""),
    createdAt: String(o.createdAt ?? ""),
  };
}

function sofFromJson(raw: unknown): AdminSourceOfFundsRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  const userId = str(o.userId);
  if (!id || !userId) return null;
  return {
    id,
    userId,
    status: str(o.status),
    trigger: str(o.trigger),
    thresholdAmount: str(o.thresholdAmount),
    exposureAmount: str(o.exposureAmount),
    currency: str(o.currency) || "GBP",
    declaredSource: o.declaredSource == null ? null : str(o.declaredSource),
    evidence: Array.isArray(o.evidence) ? o.evidence.map((e) => String(e)) : [],
    triageRecommendation: o.triageRecommendation == null ? null : str(o.triageRecommendation),
    triagedByUserId: o.triagedByUserId == null ? null : str(o.triagedByUserId),
    triagedAt: o.triagedAt == null ? null : String(o.triagedAt),
    triageNotes: o.triageNotes == null ? null : str(o.triageNotes),
    reviewedByUserId: o.reviewedByUserId == null ? null : str(o.reviewedByUserId),
    reviewedAt: o.reviewedAt == null ? null : String(o.reviewedAt),
    reviewNotes: o.reviewNotes == null ? null : str(o.reviewNotes),
    createdAt: String(o.createdAt ?? ""),
    updatedAt: String(o.updatedAt ?? ""),
  };
}

/** Align with nav badge fetch cap so queue rows match sidebar counts. */
export const COMPLIANCE_QUEUE_LIST_LIMIT = 200;

export async function getAdminAmlScreeningsPending(
  limit = COMPLIANCE_QUEUE_LIST_LIMIT,
): Promise<AdminAmlScreeningRow[]> {
  const res = await authedServerFetch(`/admin/compliance/aml/screenings?limit=${limit}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load AML screenings",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map(screeningFromJson).filter((r): r is AdminAmlScreeningRow => r != null);
}

export async function getAdminSourceOfFundsPending(
  limit = COMPLIANCE_QUEUE_LIST_LIMIT,
): Promise<AdminSourceOfFundsRow[]> {
  return getAdminSourceOfFundsByStatus("pending", limit);
}

export async function getAdminSourceOfFundsRejected(limit = 50): Promise<AdminSourceOfFundsRow[]> {
  return getAdminSourceOfFundsByStatus("rejected", limit);
}

async function getAdminSourceOfFundsByStatus(
  status: "pending" | "rejected",
  limit = 50,
): Promise<AdminSourceOfFundsRow[]> {
  const res = await authedServerFetch(
    `/admin/compliance/source-of-funds?limit=${limit}&status=${status}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds cases",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map(sofFromJson).filter((r): r is AdminSourceOfFundsRow => r != null);
}
