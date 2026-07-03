import { num, str } from "@/lib/data/http/compliance.shared";
import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

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
    staffReview: {
      checks: {
        matchesDeclaredSource?: boolean;
        coversExposure?: boolean;
        recentEnough?: boolean;
        legibleComplete?: boolean;
      };
      note: string | null;
      reviewedAt: string;
      reviewedBy: { id: string; label: string | null };
    } | null;
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

function parseSettlementItem(raw: unknown): AdminSourceOfFundsSettlementItem | null {
  if (!isIndexableObject(raw)) return null;
  const lotId = str(raw.lotId);
  const kind = raw.kind === "won_unpaid" ? "won_unpaid" : raw.kind === "payment" ? "payment" : null;
  if (!lotId || !kind) return null;
  return {
    kind,
    lotId,
    lotTitle: str(raw.lotTitle),
    lotNumber: raw.lotNumber == null ? null : num(raw.lotNumber),
    saleId: str(raw.saleId),
    saleTitle: str(raw.saleTitle),
    amountPence: num(raw.amountPence),
    ...(raw.paymentId != null ? { paymentId: str(raw.paymentId) } : {}),
    ...(raw.paymentStatus != null ? { paymentStatus: str(raw.paymentStatus) } : {}),
  };
}

function parseDocumentRequest(raw: unknown): AdminSourceOfFundsDetail["documentRequest"] {
  if (!isIndexableObject(raw)) {
    return {
      requestedAt: null,
      requestedByUserId: null,
      note: null,
      requestedDocumentTypes: [],
      submittedAt: null,
    };
  }
  return {
    requestedAt: raw.requestedAt == null ? null : String(raw.requestedAt),
    requestedByUserId: raw.requestedByUserId == null ? null : str(raw.requestedByUserId),
    note: raw.note == null ? null : str(raw.note),
    requestedDocumentTypes: Array.isArray(raw.requestedDocumentTypes)
      ? raw.requestedDocumentTypes.map(String)
      : [],
    submittedAt: raw.submittedAt == null ? null : String(raw.submittedAt),
  };
}

function parseStaffReview(
  raw: unknown,
): AdminSourceOfFundsDetail["submittedDocuments"][number]["staffReview"] {
  if (!isIndexableObject(raw)) return null;
  const reviewedByRaw = raw.reviewedBy;
  if (!isIndexableObject(reviewedByRaw)) return null;
  const reviewedById = str(reviewedByRaw.id);
  if (!reviewedById) return null;
  const checksRaw = raw.checks;
  const checks = isIndexableObject(checksRaw) ? checksRaw : {};
  return {
    checks: {
      matchesDeclaredSource: Boolean(checks.matchesDeclaredSource),
      coversExposure: Boolean(checks.coversExposure),
      recentEnough: Boolean(checks.recentEnough),
      legibleComplete: Boolean(checks.legibleComplete),
    },
    note: raw.note == null ? null : str(raw.note),
    reviewedAt: String(raw.reviewedAt ?? ""),
    reviewedBy: {
      id: reviewedById,
      label: reviewedByRaw.label == null ? null : str(reviewedByRaw.label),
    },
  };
}

function parseSubmittedDocuments(raw: unknown): AdminSourceOfFundsDetail["submittedDocuments"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!isIndexableObject(item)) return null;
      const id = str(item.id);
      if (!id) return null;
      return {
        id,
        requestedType: str(item.requestedType),
        label: item.label == null ? null : str(item.label),
        fileName: item.fileName == null ? null : str(item.fileName),
        reviewStatus: str(item.reviewStatus),
        uploadedAt: String(item.uploadedAt ?? ""),
        uploadedByUserId: str(item.uploadedByUserId),
        downloadUrl: item.downloadUrl == null ? null : str(item.downloadUrl),
        staffReview: parseStaffReview(item.staffReview),
      };
    })
    .filter((d): d is NonNullable<typeof d> => d != null);
}

function parseActor(value: unknown): { id: string; label: string | null } | null {
  if (!isIndexableObject(value)) return null;
  const id = str(value.id);
  if (!id) return null;
  return { id, label: value.label == null ? null : str(value.label) };
}

const sofRowSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminSourceOfFundsRow | null => {
    if (!isIndexableObject(raw)) return null;
    const id = str(raw.id);
    const userId = str(raw.userId);
    if (!id || !userId) return null;
    return {
      id,
      userId,
      status: str(raw.status),
      trigger: str(raw.trigger),
      thresholdAmount: str(raw.thresholdAmount),
      exposureAmount: str(raw.exposureAmount),
      currency: str(raw.currency) || "GBP",
      declaredSource: raw.declaredSource == null ? null : str(raw.declaredSource),
      evidence: Array.isArray(raw.evidence) ? raw.evidence.map((e) => String(e)) : [],
      triageRecommendation: raw.triageRecommendation == null ? null : str(raw.triageRecommendation),
      triagedByUserId: raw.triagedByUserId == null ? null : str(raw.triagedByUserId),
      triagedAt: raw.triagedAt == null ? null : String(raw.triagedAt),
      triageNotes: raw.triageNotes == null ? null : str(raw.triageNotes),
      reviewedByUserId: raw.reviewedByUserId == null ? null : str(raw.reviewedByUserId),
      reviewedAt: raw.reviewedAt == null ? null : String(raw.reviewedAt),
      reviewNotes: raw.reviewNotes == null ? null : str(raw.reviewNotes),
      createdAt: String(raw.createdAt ?? ""),
      updatedAt: String(raw.updatedAt ?? ""),
      buyerEmail: raw.buyerEmail == null ? null : str(raw.buyerEmail),
      buyerName: raw.buyerName == null ? null : str(raw.buyerName),
      buyerLabel: raw.buyerLabel == null ? null : str(raw.buyerLabel),
      settlementSummary: raw.settlementSummary == null ? null : str(raw.settlementSummary),
      settlementItemCount: num(raw.settlementItemCount),
      pendingCasesForBuyer: num(raw.pendingCasesForBuyer),
    };
  });

const sofDetailSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): AdminSourceOfFundsDetail | null => {
    if (!isIndexableObject(raw)) return null;
    const caseRow = sofFromJson(raw.case);
    if (!caseRow) return null;

    const buyerRaw = raw.buyer;
    if (!isIndexableObject(buyerRaw)) return null;
    const buyerId = str(buyerRaw.id);
    if (!buyerId) return null;

    const settlementItems = Array.isArray(raw.settlementItems)
      ? raw.settlementItems
          .map(parseSettlementItem)
          .filter((i): i is AdminSourceOfFundsSettlementItem => i != null)
      : [];

    const blockedPayments = Array.isArray(raw.blockedPayments)
      ? raw.blockedPayments
          .map((p) => {
            if (!isIndexableObject(p)) return null;
            const paymentId = str(p.paymentId);
            const lotId = str(p.lotId);
            if (!paymentId || !lotId) return null;
            return {
              paymentId,
              lotId,
              lotTitle: str(p.lotTitle),
              lotNumber: p.lotNumber == null ? null : num(p.lotNumber),
              manualReviewReason: "source_of_funds_required" as const,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p != null)
      : [];

    const evidenceDownloads = Array.isArray(raw.evidenceDownloads)
      ? raw.evidenceDownloads
          .map((e) => {
            if (!isIndexableObject(e)) return null;
            const key = str(e.key);
            if (!key) return null;
            return {
              key,
              fileName: str(e.fileName) || key.split("/").pop() || key,
              downloadUrl: e.downloadUrl == null ? null : str(e.downloadUrl),
              ...(e.error != null ? { error: str(e.error) } : {}),
            };
          })
          .filter((e): e is NonNullable<typeof e> => e != null)
      : [];

    return {
      case: caseRow,
      buyer: {
        id: buyerId,
        email: buyerRaw.email == null ? null : str(buyerRaw.email),
        name: buyerRaw.name == null ? null : str(buyerRaw.name),
        label: buyerRaw.label == null ? null : str(buyerRaw.label),
      },
      triagedBy: parseActor(raw.triagedBy),
      reviewedBy: parseActor(raw.reviewedBy),
      exposureAtOpenPence: num(raw.exposureAtOpenPence),
      currentActiveExposurePence: num(raw.currentActiveExposurePence),
      settlementItems,
      blockedPayments,
      evidenceDownloads,
      documentRequest: parseDocumentRequest(raw.documentRequest),
      submittedDocuments: parseSubmittedDocuments(raw.submittedDocuments),
    };
  });

const buyerSofViewSchema = z
  .preprocess((raw) => raw, z.unknown())
  .transform((raw): BuyerSourceOfFundsView | null => {
    if (!isIndexableObject(raw)) return null;
    const caseId = str(raw.caseId);
    if (!caseId) return null;
    return {
      caseId,
      status: str(raw.status),
      trigger: str(raw.trigger),
      documentsRequested: Boolean(raw.documentsRequested),
      documentsSubmitted: Boolean(raw.documentsSubmitted),
      requestedDocumentTypes: Array.isArray(raw.requestedDocumentTypes)
        ? raw.requestedDocumentTypes.map(String)
        : [],
      documentRequestNote: raw.documentRequestNote == null ? null : str(raw.documentRequestNote),
      documents: Array.isArray(raw.documents)
        ? raw.documents
            .map((d) => {
              if (!isIndexableObject(d)) return null;
              const id = str(d.id);
              if (!id) return null;
              const statusLabel = d.statusLabel;
              const normalizedStatus: BuyerSourceOfFundsView["documents"][number]["statusLabel"] =
                statusLabel === "under_review" || statusLabel === "superseded"
                  ? statusLabel
                  : "received";
              return {
                id,
                requestedType: str(d.requestedType),
                label: d.label == null ? null : str(d.label),
                fileName: d.fileName == null ? null : str(d.fileName),
                statusLabel: normalizedStatus,
                uploadedAt: String(d.uploadedAt ?? ""),
              };
            })
            .filter((d): d is NonNullable<typeof d> => d != null)
        : [],
      settlementSummary: raw.settlementSummary == null ? null : str(raw.settlementSummary),
      settlementItemCount: num(raw.settlementItemCount),
      decisionOutcome:
        raw.decisionOutcome === "approved" || raw.decisionOutcome === "rejected"
          ? raw.decisionOutcome
          : null,
    };
  });

export const adminSourceOfFundsRowSchema = sofRowSchema as z.ZodType<AdminSourceOfFundsRow | null>;
export const adminSourceOfFundsDetailSchema =
  sofDetailSchema as z.ZodType<AdminSourceOfFundsDetail | null>;
export const buyerSourceOfFundsViewSchema =
  buyerSofViewSchema as z.ZodType<BuyerSourceOfFundsView | null>;

export function sofFromJson(raw: unknown): AdminSourceOfFundsRow | null {
  return sofRowSchema.parse(raw);
}

export function sofDetailFromJson(raw: unknown): AdminSourceOfFundsDetail | null {
  return sofDetailSchema.parse(raw);
}

export function buyerSofViewFromJson(raw: unknown): BuyerSourceOfFundsView | null {
  return buyerSofViewSchema.parse(raw);
}

type _SofRowInfer = z.infer<typeof sofRowSchema>;
const _sofRowTypeGuard = null as unknown as _SofRowInfer satisfies AdminSourceOfFundsRow | null;
void _sofRowTypeGuard;
