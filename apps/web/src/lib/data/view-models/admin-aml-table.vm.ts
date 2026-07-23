import {
  amlDecisionOutcomeLabel,
  amlMatchStatusLabel,
  amlMonitorStatusLabel,
  formatAmlCategoriesLabel,
} from "@/lib/admin/status-badge-variants";
import type {
  AdminAmlScreeningHitRow,
  AdminAmlScreeningRow,
} from "@/lib/data/http/compliance.server";

export type AdminAmlTableRow = {
  id: string;
  userId: string;
  providerSessionId: string;
  matchStatus: string;
  matchStatusLabel: string;
  monitorStatus: string;
  monitorStatusLabel: string;
  decisionOutcome: string;
  decisionOutcomeLabel: string;
  categoriesLabel: string;
  triageLabel: string;
  totalHits: number;
  screenedAt: string;
  checkType: string | null;
  hits: AdminAmlScreeningHitRow[];
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triageNotes: string | null;
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
    matchStatusLabel: amlMatchStatusLabel[row.matchStatus] ?? humanizeToken(row.matchStatus),
    monitorStatus: row.monitorStatus,
    monitorStatusLabel:
      amlMonitorStatusLabel[row.monitorStatus] ?? humanizeToken(row.monitorStatus),
    decisionOutcome: row.decisionOutcome,
    decisionOutcomeLabel:
      amlDecisionOutcomeLabel[row.decisionOutcome] ?? humanizeToken(row.decisionOutcome),
    categoriesLabel: formatAmlCategoriesLabel(row.categories),
    triageLabel: triageLabel(row.triageRecommendation),
    totalHits: row.totalHits,
    screenedAt: row.screenedAt,
    checkType: row.checkType,
    hits: row.hits,
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
    if (!row.triageRecommendation) {
      pending += 1;
      continue;
    }
    triaged += 1;
    if (row.triageRecommendation === "recommend_block") escalated += 1;
  }
  return { pending, triaged, escalated };
}
