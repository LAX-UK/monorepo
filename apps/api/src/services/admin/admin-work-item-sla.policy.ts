import type {
  AdminWorkItemSourceKind,
  AdminWorkItemSourceRow,
} from "@auction/persistence/interfaces";

export type WorkItemSeverity = "critical" | "high" | "medium" | "low";

export type WorkItemSlaPresentation = {
  severity: WorkItemSeverity;
  dueAt: string | null;
  isOverdue: boolean;
  urgencyLabel: string | null;
};

const SEVERITY_RANK: Record<WorkItemSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Per-kind SLA thresholds — single source of truth for due dates and severity. */
const SLA_MS: Partial<Record<AdminWorkItemSourceKind, number>> = {
  payment_manual_review: 48 * 60 * 60 * 1000,
  submission_review: 72 * 60 * 60 * 1000,
  condition_report: 48 * 60 * 60 * 1000,
  sale_registration: 24 * 60 * 60 * 1000,
  telephone_booking: 24 * 60 * 60 * 1000,
  aml_screening: 24 * 60 * 60 * 1000,
  sof_case: 24 * 60 * 60 * 1000,
  legal_entity_kyb: 72 * 60 * 60 * 1000,
};

const BASE_SEVERITY: Record<AdminWorkItemSourceKind, WorkItemSeverity> = {
  payment_manual_review: "critical",
  aml_screening: "high",
  sof_case: "high",
  submission_review: "medium",
  condition_report: "medium",
  lot_fulfilment: "medium",
  sale_registration: "high",
  telephone_booking: "high",
  legal_entity_kyb: "medium",
  lot_withdrawal: "medium",
  lot_draft_past_start: "critical",
};

export function applyWorkItemSla(
  row: AdminWorkItemSourceRow,
  now = Date.now(),
): WorkItemSlaPresentation {
  const baseSeverity = BASE_SEVERITY[row.kind];
  const slaMs = SLA_MS[row.kind];

  if (row.kind === "lot_draft_past_start") {
    const startMs = row.sourceUpdatedAt.getTime();
    const isOverdue = startMs < now;
    return {
      severity: isOverdue ? "critical" : "high",
      dueAt: null,
      isOverdue,
      urgencyLabel: isOverdue ? "Overdue start" : "Draft awaiting publish",
    };
  }

  if (slaMs == null) {
    return {
      severity: baseSeverity,
      dueAt: null,
      isOverdue: false,
      urgencyLabel: null,
    };
  }

  const sourceMs = row.sourceUpdatedAt.getTime();
  const dueAt = new Date(sourceMs + slaMs);
  const isOverdue = now >= dueAt.getTime();
  const ageHours = Math.floor(Math.max(0, now - sourceMs) / (60 * 60 * 1000));

  let severity = baseSeverity;
  if (isOverdue && (baseSeverity === "medium" || baseSeverity === "high")) {
    severity = baseSeverity === "high" ? "critical" : "high";
  }

  const urgencyLabel =
    row.kind === "payment_manual_review"
      ? isOverdue
        ? "Over 48h"
        : ageHours <= 1
          ? "Pending < 2h"
          : `${ageHours}h pending`
      : isOverdue
        ? "Over SLA"
        : ageHours >= 24
          ? `${ageHours}h waiting`
          : null;

  return {
    severity,
    dueAt: dueAt.toISOString(),
    isOverdue,
    urgencyLabel,
  };
}

export function compareWorkItems(
  a: {
    severity: WorkItemSeverity;
    isOverdue: boolean;
    dueAt: string | null;
    sourceUpdatedAt: string;
    id: string;
  },
  b: {
    severity: WorkItemSeverity;
    isOverdue: boolean;
    dueAt: string | null;
    sourceUpdatedAt: string;
    id: string;
  },
): number {
  const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (sev !== 0) return sev;

  const overdueA = a.isOverdue ? 0 : 1;
  const overdueB = b.isOverdue ? 0 : 1;
  if (overdueA !== overdueB) return overdueA - overdueB;

  const dueA = a.dueAt ? Date.parse(a.dueAt) : null;
  const dueB = b.dueAt ? Date.parse(b.dueAt) : null;
  if (dueA != null && dueB != null && dueA !== dueB) return dueA - dueB;
  if (dueA != null && dueB == null) return -1;
  if (dueA == null && dueB != null) return 1;

  const ageA = Date.parse(a.sourceUpdatedAt);
  const ageB = Date.parse(b.sourceUpdatedAt);
  if (ageA !== ageB) return ageA - ageB;

  return a.id.localeCompare(b.id);
}

export function isUrgentWorkItem(item: {
  severity: WorkItemSeverity;
  isOverdue: boolean;
}): boolean {
  return item.severity === "critical" || item.severity === "high" || item.isOverdue;
}
