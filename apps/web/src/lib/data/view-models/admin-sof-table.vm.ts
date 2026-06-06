import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";

export type AdminSofTableRow = {
  id: string;
  userId: string;
  status: string;
  statusLabel: string;
  trigger: string;
  triggerLabel: string;
  exposureLabel: string;
  thresholdLabel: string;
  triageLabel: string;
  declaredSource: string | null;
  triageRecommendation: string | null;
  triagedByUserId: string | null;
  triageNotes: string | null;
};

const TRIGGER_LABELS: Record<string, string> = {
  threshold_exceeded: "Threshold exceeded",
  manual_flag: "Manual flag",
  repeat_buyer: "Repeat buyer",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
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

function moneyLabel(currency: string, amount: string): string {
  const trimmed = amount.trim();
  return trimmed.length > 0 ? `${currency} ${trimmed}` : currency;
}

export function buildAdminSofTableRow(row: AdminSourceOfFundsRow): AdminSofTableRow {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? humanizeToken(row.status),
    trigger: row.trigger,
    triggerLabel: TRIGGER_LABELS[row.trigger] ?? humanizeToken(row.trigger),
    exposureLabel: moneyLabel(row.currency, row.exposureAmount),
    thresholdLabel: moneyLabel(row.currency, row.thresholdAmount),
    triageLabel: triageLabel(row.triageRecommendation),
    declaredSource: row.declaredSource,
    triageRecommendation: row.triageRecommendation,
    triagedByUserId: row.triagedByUserId,
    triageNotes: row.triageNotes,
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
