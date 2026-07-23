import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { formatDateTime, formatMoney } from "@/lib/ui/format";

export type SofDisplayStatus = "pending" | "awaiting_decision" | "approved" | "rejected";

export type AdminSofTableRow = {
  id: string;
  userId: string;
  status: string;
  displayStatus: SofDisplayStatus;
  statusLabel: string;
  trigger: string;
  triggerLabel: string;
  triggerExplanation: string;
  exposureLabel: string;
  thresholdLabel: string;
  triageLabel: string;
  buyerLabel: string;
  settlementSummary: string | null;
  settlementItemCount: number;
  pendingCasesForBuyer: number;
  openedLabel: string;
  reviewedLabel: string;
  declaredSource: string | null;
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triagedAt: string | null;
  triageNotes: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  evidenceCount: number;
  evidenceKeys: string[];
};

const TRIGGER_LABELS: Record<string, string> = {
  threshold: "Single transaction threshold",
  linked_transactions: "Aggregated linked transactions",
  risk_indicator: "Risk indicator",
  manual: "Manual compliance flag",
};

const TRIGGER_EXPLANATIONS: Record<string, string> = {
  threshold: "Opened because a single transaction crossed the SoF threshold.",
  linked_transactions: "Opened because combined active settlements exceeded the SoF threshold.",
  risk_indicator: "Opened in response to a compliance risk indicator.",
  manual: "Opened manually by compliance staff.",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

function humanizeToken(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveSofDisplayStatus(
  status: string,
  triageRecommendation: string | null,
): SofDisplayStatus {
  if (status === "pending" && triageRecommendation) return "awaiting_decision";
  if (status === "pending" || status === "approved" || status === "rejected") {
    return status;
  }
  return "pending";
}

function triageLabel(recommendation: string | null): string {
  if (!recommendation) return "Awaiting triage";
  if (recommendation === "recommend_approve") return "Recommend approve";
  if (recommendation === "recommend_reject") return "Recommend reject";
  if (recommendation.startsWith("recommend_")) {
    return `Recommend ${humanizeToken(recommendation.slice("recommend_".length)).toLowerCase()}`;
  }
  return humanizeToken(recommendation);
}

function moneyLabel(currency: string, amount: string): string {
  const trimmed = amount.trim();
  return trimmed.length > 0 ? `${currency} ${trimmed}` : currency;
}

export function formatExposurePence(pence: number, currency = "GBP"): string {
  return formatMoney(pence / 100, currency);
}

export function buildSettlementSummaryLabel(summary: string | null, count: number): string | null {
  if (summary) return summary;
  if (count === 0) return null;
  return `${count} settlement${count === 1 ? "" : "s"}`;
}

export function buildAdminSofTableRow(row: AdminSourceOfFundsRow): AdminSofTableRow {
  const displayStatus = resolveSofDisplayStatus(row.status, row.triageRecommendation);
  const buyerLabel = row.buyerLabel?.trim() || row.buyerEmail?.trim() || "Unknown buyer";
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    displayStatus,
    statusLabel: STATUS_LABELS[row.status] ?? humanizeToken(row.status),
    trigger: row.trigger,
    triggerLabel: TRIGGER_LABELS[row.trigger] ?? humanizeToken(row.trigger),
    triggerExplanation: TRIGGER_EXPLANATIONS[row.trigger] ?? "",
    exposureLabel: moneyLabel(row.currency, row.exposureAmount),
    thresholdLabel: moneyLabel(row.currency, row.thresholdAmount),
    triageLabel: triageLabel(row.triageRecommendation),
    buyerLabel,
    settlementSummary: buildSettlementSummaryLabel(row.settlementSummary, row.settlementItemCount),
    settlementItemCount: row.settlementItemCount ?? 0,
    pendingCasesForBuyer: row.pendingCasesForBuyer ?? 0,
    openedLabel: row.createdAt ? formatDateTime(row.createdAt) : "—",
    reviewedLabel: row.reviewedAt ? formatDateTime(row.reviewedAt) : "—",
    declaredSource: row.declaredSource,
    triageRecommendation: row.triageRecommendation,
    triagedByUserId: row.triagedByUserId,
    triagedAt: row.triagedAt,
    triageNotes: row.triageNotes,
    reviewedAt: row.reviewedAt,
    reviewNotes: row.reviewNotes,
    reviewedByUserId: row.reviewedByUserId,
    createdAt: row.createdAt,
    evidenceCount:
      typeof row.submittedDocumentCount === "number"
        ? row.submittedDocumentCount
        : Array.isArray(row.evidence)
          ? row.evidence.length
          : 0,
    evidenceKeys: Array.isArray(row.evidence) ? row.evidence.map(String) : [],
  };
}

export function buildAdminSofTableRows(rows: AdminSourceOfFundsRow[]): AdminSofTableRow[] {
  return rows.map(buildAdminSofTableRow);
}

export function summarizeSofQueue(rows: AdminSofTableRow[]): {
  pending: number;
  triaged: number;
} {
  let pending = 0;
  let triaged = 0;
  for (const row of rows) {
    if (row.triageRecommendation) triaged += 1;
    else pending += 1;
  }
  return { pending, triaged };
}
