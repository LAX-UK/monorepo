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
  hits: AdminAmlScreeningHitRow[];
  checkType: string | null;
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

export type AdminAmlScreeningHitRow = {
  matchedName: string | null;
  countries: string[];
  dateOfBirth: string | null;
  matchTypes: string[];
  categories: string[];
  listings: Partial<
    Record<
      string,
      Array<{
        sourceName: string;
        sourceUrl: string | null;
        snippet: string | null;
        date: string | null;
      }>
    >
  >;
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

export function screeningFromJson(raw: unknown): AdminAmlScreeningRow | null {
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
  const hits = Array.isArray(o.hits)
    ? o.hits.map((hit) => {
        const h = hit as Record<string, unknown>;
        return {
          matchedName: h.matchedName == null ? null : str(h.matchedName),
          countries: Array.isArray(h.countries) ? h.countries.map(String) : [],
          dateOfBirth: h.dateOfBirth == null ? null : str(h.dateOfBirth),
          matchTypes: Array.isArray(h.matchTypes) ? h.matchTypes.map(String) : [],
          categories: Array.isArray(h.categories) ? h.categories.map(String) : [],
          listings:
            h.listings && typeof h.listings === "object"
              ? (h.listings as AdminAmlScreeningHitRow["listings"])
              : {},
        };
      })
    : [];
  return {
    id,
    userId,
    providerSessionId: str(o.providerSessionId),
    matchStatus: str(o.matchStatus),
    monitorStatus: str(o.monitorStatus),
    totalHits: Number(o.totalHits ?? 0),
    categories,
    hits,
    checkType: o.checkType == null ? null : str(o.checkType),
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
  offset = 0,
): Promise<AdminAmlScreeningRow[]> {
  const page = await getAdminAmlScreeningsPage({ limit, offset });
  return page.rows;
}

export async function getAdminAmlScreeningsPage(params: {
  limit: number;
  offset: number;
}): Promise<{ rows: AdminAmlScreeningRow[]; total: number }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  const res = await authedServerFetch(`/admin/compliance/aml/screenings?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load AML screenings",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown; meta?: { total?: number } };
  const rows = Array.isArray(json.data) ? json.data : [];
  return {
    rows: rows.map(screeningFromJson).filter((r): r is AdminAmlScreeningRow => r != null),
    total: json.meta?.total ?? rows.length,
  };
}

export async function getAdminSourceOfFundsPending(
  limit = COMPLIANCE_QUEUE_LIST_LIMIT,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "pending", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsRejected(
  limit = 50,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "rejected", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsApproved(
  limit = 50,
  offset = 0,
): Promise<AdminSourceOfFundsRow[]> {
  const page = await getAdminSourceOfFundsPage({ status: "approved", limit, offset });
  return page.rows;
}

export async function getAdminSourceOfFundsPage(params: {
  status: "pending" | "rejected" | "approved";
  limit: number;
  offset: number;
}): Promise<{ rows: AdminSourceOfFundsRow[]; total: number }> {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    status: params.status,
  });
  const res = await authedServerFetch(`/admin/compliance/source-of-funds?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds cases",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown; meta?: { total?: number } };
  const rows = Array.isArray(json.data) ? json.data : [];
  return {
    rows: rows.map(sofFromJson).filter((r): r is AdminSourceOfFundsRow => r != null),
    total: json.meta?.total ?? rows.length,
  };
}
