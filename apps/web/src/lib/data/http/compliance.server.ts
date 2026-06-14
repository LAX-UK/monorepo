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
  buyerEmail: string | null;
  buyerName: string | null;
  buyerLabel: string | null;
  settlementSummary: string | null;
  settlementItemCount: number;
  pendingCasesForBuyer: number;
};

export type AdminSourceOfFundsSettlementItem = {
  kind: "payment" | "won_unpaid";
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  saleId: string;
  saleTitle: string;
  amountPence: number;
  paymentId?: string;
  paymentStatus?: string;
};

export type AdminSourceOfFundsDetail = {
  case: AdminSourceOfFundsRow;
  buyer: {
    id: string;
    email: string | null;
    name: string | null;
    label: string | null;
  };
  triagedBy: { id: string; label: string | null } | null;
  reviewedBy: { id: string; label: string | null } | null;
  exposureAtOpenPence: number;
  currentActiveExposurePence: number;
  settlementItems: AdminSourceOfFundsSettlementItem[];
  blockedPayments: Array<{
    paymentId: string;
    lotId: string;
    lotTitle: string;
    lotNumber: number | null;
    manualReviewReason: "source_of_funds_required";
  }>;
  evidenceDownloads: Array<{
    key: string;
    fileName: string;
    downloadUrl: string | null;
    error?: string;
  }>;
  documentRequest: {
    requestedAt: string | null;
    requestedByUserId: string | null;
    note: string | null;
    requestedDocumentTypes: string[];
    submittedAt: string | null;
  };
  submittedDocuments: Array<{
    id: string;
    requestedType: string;
    label: string | null;
    fileName: string | null;
    reviewStatus: string;
    uploadedAt: string;
    uploadedByUserId: string;
    downloadUrl: string | null;
  }>;
};

export type BuyerSourceOfFundsView = {
  caseId: string;
  status: string;
  trigger: string;
  documentsRequested: boolean;
  documentsSubmitted: boolean;
  requestedDocumentTypes: string[];
  documentRequestNote: string | null;
  documents: Array<{
    id: string;
    requestedType: string;
    label: string | null;
    fileName: string | null;
    statusLabel: "received" | "under_review" | "superseded";
    uploadedAt: string;
  }>;
  settlementSummary: string | null;
  settlementItemCount: number;
  decisionOutcome: "approved" | "rejected" | null;
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

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
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
    buyerEmail: o.buyerEmail == null ? null : str(o.buyerEmail),
    buyerName: o.buyerName == null ? null : str(o.buyerName),
    buyerLabel: o.buyerLabel == null ? null : str(o.buyerLabel),
    settlementSummary: o.settlementSummary == null ? null : str(o.settlementSummary),
    settlementItemCount: num(o.settlementItemCount),
    pendingCasesForBuyer: num(o.pendingCasesForBuyer),
  };
}

function settlementItemFromJson(raw: unknown): AdminSourceOfFundsSettlementItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lotId = str(o.lotId);
  const kind = o.kind === "won_unpaid" ? "won_unpaid" : o.kind === "payment" ? "payment" : null;
  if (!lotId || !kind) return null;
  return {
    kind,
    lotId,
    lotTitle: str(o.lotTitle),
    lotNumber: o.lotNumber == null ? null : num(o.lotNumber),
    saleId: str(o.saleId),
    saleTitle: str(o.saleTitle),
    amountPence: num(o.amountPence),
    ...(o.paymentId != null ? { paymentId: str(o.paymentId) } : {}),
    ...(o.paymentStatus != null ? { paymentStatus: str(o.paymentStatus) } : {}),
  };
}

export function sofDetailFromJson(raw: unknown): AdminSourceOfFundsDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const caseRaw = o.case;
  const caseRow = sofFromJson(caseRaw);
  if (!caseRow) return null;

  const buyerRaw = o.buyer;
  if (!buyerRaw || typeof buyerRaw !== "object") return null;
  const buyer = buyerRaw as Record<string, unknown>;
  const buyerId = str(buyer.id);
  if (!buyerId) return null;

  const parseActor = (value: unknown): { id: string; label: string | null } | null => {
    if (!value || typeof value !== "object") return null;
    const a = value as Record<string, unknown>;
    const id = str(a.id);
    if (!id) return null;
    return { id, label: a.label == null ? null : str(a.label) };
  };

  const settlementItems = Array.isArray(o.settlementItems)
    ? o.settlementItems
        .map(settlementItemFromJson)
        .filter((i): i is AdminSourceOfFundsSettlementItem => i != null)
    : [];

  const blockedPayments = Array.isArray(o.blockedPayments)
    ? o.blockedPayments
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const row = p as Record<string, unknown>;
          const paymentId = str(row.paymentId);
          const lotId = str(row.lotId);
          if (!paymentId || !lotId) return null;
          return {
            paymentId,
            lotId,
            lotTitle: str(row.lotTitle),
            lotNumber: row.lotNumber == null ? null : num(row.lotNumber),
            manualReviewReason: "source_of_funds_required" as const,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p != null)
    : [];

  const evidenceDownloads = Array.isArray(o.evidenceDownloads)
    ? o.evidenceDownloads
        .map((e) => {
          if (!e || typeof e !== "object") return null;
          const row = e as Record<string, unknown>;
          const key = str(row.key);
          if (!key) return null;
          return {
            key,
            fileName: str(row.fileName) || key.split("/").pop() || key,
            downloadUrl: row.downloadUrl == null ? null : str(row.downloadUrl),
            ...(row.error != null ? { error: str(row.error) } : {}),
          };
        })
        .filter((e): e is NonNullable<typeof e> => e != null)
    : [];

  return {
    case: caseRow,
    buyer: {
      id: buyerId,
      email: buyer.email == null ? null : str(buyer.email),
      name: buyer.name == null ? null : str(buyer.name),
      label: buyer.label == null ? null : str(buyer.label),
    },
    triagedBy: parseActor(o.triagedBy),
    reviewedBy: parseActor(o.reviewedBy),
    exposureAtOpenPence: num(o.exposureAtOpenPence),
    currentActiveExposurePence: num(o.currentActiveExposurePence),
    settlementItems,
    blockedPayments,
    evidenceDownloads,
    documentRequest: parseDocumentRequest(o.documentRequest),
    submittedDocuments: parseSubmittedDocuments(o.submittedDocuments),
  };
}

function parseDocumentRequest(raw: unknown): AdminSourceOfFundsDetail["documentRequest"] {
  if (!raw || typeof raw !== "object") {
    return {
      requestedAt: null,
      requestedByUserId: null,
      note: null,
      requestedDocumentTypes: [],
      submittedAt: null,
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    requestedAt: o.requestedAt == null ? null : String(o.requestedAt),
    requestedByUserId: o.requestedByUserId == null ? null : str(o.requestedByUserId),
    note: o.note == null ? null : str(o.note),
    requestedDocumentTypes: Array.isArray(o.requestedDocumentTypes)
      ? o.requestedDocumentTypes.map(String)
      : [],
    submittedAt: o.submittedAt == null ? null : String(o.submittedAt),
  };
}

function parseSubmittedDocuments(raw: unknown): AdminSourceOfFundsDetail["submittedDocuments"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      const id = str(o.id);
      if (!id) return null;
      return {
        id,
        requestedType: str(o.requestedType),
        label: o.label == null ? null : str(o.label),
        fileName: o.fileName == null ? null : str(o.fileName),
        reviewStatus: str(o.reviewStatus),
        uploadedAt: String(o.uploadedAt ?? ""),
        uploadedByUserId: str(o.uploadedByUserId),
        downloadUrl: o.downloadUrl == null ? null : str(o.downloadUrl),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d != null);
}

export function buyerSofViewFromJson(raw: unknown): BuyerSourceOfFundsView | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const caseId = str(o.caseId);
  if (!caseId) return null;
  return {
    caseId,
    status: str(o.status),
    trigger: str(o.trigger),
    documentsRequested: Boolean(o.documentsRequested),
    documentsSubmitted: Boolean(o.documentsSubmitted),
    requestedDocumentTypes: Array.isArray(o.requestedDocumentTypes)
      ? o.requestedDocumentTypes.map(String)
      : [],
    documentRequestNote: o.documentRequestNote == null ? null : str(o.documentRequestNote),
    documents: Array.isArray(o.documents)
      ? o.documents
          .map((d) => {
            if (!d || typeof d !== "object") return null;
            const row = d as Record<string, unknown>;
            const id = str(row.id);
            if (!id) return null;
            const statusLabel = row.statusLabel;
            const normalizedStatus: BuyerSourceOfFundsView["documents"][number]["statusLabel"] =
              statusLabel === "under_review" || statusLabel === "superseded"
                ? statusLabel
                : "received";
            return {
              id,
              requestedType: str(row.requestedType),
              label: row.label == null ? null : str(row.label),
              fileName: row.fileName == null ? null : str(row.fileName),
              statusLabel: normalizedStatus,
              uploadedAt: String(row.uploadedAt ?? ""),
            };
          })
          .filter((d): d is NonNullable<typeof d> => d != null)
      : [],
    settlementSummary: o.settlementSummary == null ? null : str(o.settlementSummary),
    settlementItemCount: num(o.settlementItemCount),
    decisionOutcome:
      o.decisionOutcome === "approved" || o.decisionOutcome === "rejected"
        ? o.decisionOutcome
        : null,
  };
}

export async function getBuyerSourceOfFundsView(): Promise<BuyerSourceOfFundsView | null> {
  const res = await authedServerFetch("/payments/me/source-of-funds");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load source of funds status",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  return buyerSofViewFromJson(json.data);
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

export async function getAdminSourceOfFundsDetail(
  caseId: string,
): Promise<AdminSourceOfFundsDetail | null> {
  const res = await authedServerFetch(
    `/admin/compliance/source-of-funds/${encodeURIComponent(caseId)}/detail`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      normalizeApiErrorMessage(
        (body as { error?: unknown }).error,
        "Could not load Source of Funds case detail",
      ),
    );
  }
  const json = (await res.json()) as { data?: unknown };
  return sofDetailFromJson(json.data);
}
