import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";

export type AdminAmlTableRow = {
  id: string;
  userId: string;
  providerSessionId: string;
  matchStatus: string;
  matchStatusLabel: string;
  decisionOutcome: string;
  decisionOutcomeLabel: string;
  categoriesLabel: string;
  triageLabel: string;
  totalHits: number;
  screenedAt: string;
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triageNotes: string | null;
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  no_match: "No match",
  potential_match: "Potential match",
  true_positive: "Confirmed match",
  false_positive: "False positive",
};

const DECISION_OUTCOME_LABELS: Record<string, string> = {
  pending: "Pending review",
  clear: "Clear",
  block: "Block",
  escalate: "Escalated",
};

function humanizeToken(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function triageLabel(recommendation: string | null): string {
  if (!recommendation) return "Awaiting triage";
  if (recommendation.startsWith("recommend_")) {
    return humanizeToken(recommendation.slice("recommend_".length));
  }
  return humanizeToken(recommendation);
}

export function buildAdminAmlTableRow(row: AdminAmlScreeningRow): AdminAmlTableRow {
  return {
    id: row.id,
    userId: row.userId,
    providerSessionId: row.providerSessionId,
    matchStatus: row.matchStatus,
    matchStatusLabel: MATCH_STATUS_LABELS[row.matchStatus] ?? humanizeToken(row.matchStatus),
    decisionOutcome: row.decisionOutcome,
    decisionOutcomeLabel:
      DECISION_OUTCOME_LABELS[row.decisionOutcome] ?? humanizeToken(row.decisionOutcome),
    categoriesLabel: row.categories.length > 0 ? row.categories.join(", ") : "—",
    triageLabel: triageLabel(row.triageRecommendation),
    totalHits: row.totalHits,
    screenedAt: row.screenedAt,
    triageRecommendation: row.triageRecommendation,
    triagedByUserId: row.triagedByUserId,
    triageNotes: row.triageNotes,
  };
}

export function buildAdminAmlTableRows(rows: AdminAmlScreeningRow[]): AdminAmlTableRow[] {
  return rows.map(buildAdminAmlTableRow);
}

export function summarizeAmlQueue(rows: AdminAmlTableRow[]): {
  pending: number;
  triaged: number;
  escalated: number;
} {
  let pending = 0;
  let triaged = 0;
  let escalated = 0;
  for (const row of rows) {
    if (row.decisionOutcome === "escalate") escalated += 1;
    else if (row.triageRecommendation) triaged += 1;
    else pending += 1;
  }
  return { pending, triaged, escalated };
}
