import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  type SofListStatus,
  buildSofCaseDetailHref,
  parseSofListStatus,
} from "@/lib/admin/sof-list-query";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminSourceOfFundsListSummary } from "@/lib/data/http/compliance-sof.shared";
import type { AdminSourceOfFundsRow } from "@/lib/data/http/compliance.server";
import { resolveSofDisplayStatus } from "@/lib/data/view-models/admin-sof-table.vm";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffMoney,
  parsePoundsToPence,
} from "@auction/staff-ui";

export const SOF_STAFF_LIST_PATH = "/admin/compliance/source-of-funds";

export type SofListSearch = Record<string, string | string[] | undefined>;

/** One source of funds case as the staff list shows it; plain data, so it crosses to the client. */
export type SofStaffRow = {
  id: string;
  userId: string;
  /** The buyer's name or email, else "Unknown buyer". */
  buyer: string;
  /** "2 lots, £4,140.00", under the buyer; null when no settlement is attached. */
  settlement: string | null;
  /** Other open cases for the same buyer (a prompt to look at them together). */
  otherOpenCases: number;
  status: StatusPresentation;
  trigger: string;
  /** "£185,001.25". */
  exposure: string;
  exposurePence: number | null;
  evidenceCount: number;
  /** "Awaiting triage", "Recommended approve" or "Recommended reject". */
  triage: string;
  createdAt: string;
  reviewedAt: string | null;
  /** The case page the row opens; keeps the view and list so "back" returns here. */
  href: string;
  /** A rejected case can be reopened once the buyer supplies new evidence. */
  canReopen: boolean;
};

const TRIGGER_LABELS: Record<string, string> = {
  threshold: "Single transaction over the threshold",
  linked_transactions: "Linked transactions over the threshold",
  risk_indicator: "Risk indicator",
  manual: "Opened by compliance",
};

function triggerLabel(trigger: string): string {
  return (
    TRIGGER_LABELS[trigger] ?? trigger.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())
  );
}

export function sofTriageLabel(recommendation: string | null): string {
  if (!recommendation) return "Awaiting triage";
  const token = recommendation.startsWith("recommend_")
    ? recommendation.slice("recommend_".length)
    : recommendation;
  return token === "approve" || token === "reject"
    ? `Recommended ${token}`
    : token.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

/** "£185,001.25" from the API's decimal string and currency; the raw text when it is no amount. */
export function formatSofAmount(
  amount: string,
  currency: string,
): { label: string; pence: number | null } {
  const parsed = parsePoundsToPence(amount);
  return parsed.ok
    ? { label: formatStaffMoney(parsed.pence, currency || "GBP"), pence: parsed.pence }
    : { label: amount.trim() || currency, pence: null };
}

export function toSofStaffRows(
  rows: readonly AdminSourceOfFundsRow[],
  listStatus: SofListStatus,
  returnTarget?: string,
): SofStaffRow[] {
  return rows.map((row) => {
    const exposure = formatSofAmount(row.exposureAmount, row.currency);
    const evidenceCount =
      typeof row.submittedDocumentCount === "number"
        ? row.submittedDocumentCount
        : Array.isArray(row.evidence)
          ? row.evidence.length
          : 0;
    const count = row.settlementItemCount ?? 0;
    return {
      id: row.id,
      userId: row.userId,
      buyer: row.buyerLabel?.trim() || row.buyerEmail?.trim() || "Unknown buyer",
      settlement:
        row.settlementSummary?.trim() ||
        (count > 0 ? `${count} ${count === 1 ? "settlement" : "settlements"}` : null),
      otherOpenCases: Math.max(0, (row.pendingCasesForBuyer ?? 0) - 1),
      status: staffStatus("sofCase", resolveSofDisplayStatus(row.status, row.triageRecommendation)),
      trigger: triggerLabel(row.trigger),
      exposure: exposure.label,
      exposurePence: exposure.pence,
      evidenceCount,
      triage: sofTriageLabel(row.triageRecommendation),
      createdAt: row.createdAt,
      reviewedAt: row.reviewedAt,
      href: buildSofCaseDetailHref(row.id, listStatus, returnTarget),
      canReopen: row.status === "rejected",
    };
  });
}

/** A link to the list with some of its URL state changed; paging restarts. */
export function sofListHref(
  search: SofListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: SofListSearch = { ...search };
  for (const key of ["error", "success", "case"]) delete base[key];
  return buildListHref(SOF_STAFF_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

export const SOF_VIEW_LABELS: Record<SofListStatus, string> = {
  pending: "Pending",
  rejected: "Rejected",
  approved: "Approved",
};

export function activeSofView(search: SofListSearch): SofListStatus {
  return parseSofListStatus(search);
}

/** The status views as tabs. Only pending carries a count: it is the work waiting on someone. */
export function sofViews(search: SofListSearch, pendingCount: number): StaffDataView[] {
  return (["pending", "rejected", "approved"] as const).map((status) => ({
    id: status,
    label: SOF_VIEW_LABELS[status],
    href: sofListHref(search, { status: status === "pending" ? null : status }),
    ...(status === "pending" && pendingCount > 0 ? { count: pendingCount } : {}),
  }));
}

/** Work waiting beside the cases, each linking to the list that holds it. */
export function sofAttention(counts: {
  manualReviewCount: number;
  amlScreeningsPending: number;
}): AttentionStripItem[] {
  return [
    {
      id: "manual-review",
      count: counts.manualReviewCount,
      label:
        counts.manualReviewCount === 1
          ? "payment is held for manual review"
          : "payments are held for manual review",
      href: "/admin/payments?manualReview=1",
      tone: "warning",
    },
    {
      id: "aml",
      count: counts.amlScreeningsPending,
      label:
        counts.amlScreeningsPending === 1
          ? "AML screening is pending"
          : "AML screenings are pending",
      href: "/admin/compliance/aml",
    },
  ];
}

/** The numbers over the cases in the current view. */
export function sofMetrics(
  status: SofListStatus,
  summary: AdminSourceOfFundsListSummary,
): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  if (status === "pending") {
    return [
      { id: "awaiting", label: "Awaiting triage", value: count.format(summary.awaitingTriage) },
      { id: "triaged", label: "Awaiting MLRO decision", value: count.format(summary.triaged) },
      { id: "total", label: "Pending in total", value: count.format(summary.total) },
    ];
  }
  return [
    {
      id: "total",
      label: status === "rejected" ? "Rejected cases" : "Approved cases",
      value: count.format(summary.total),
    },
  ];
}

/** What a view with no cases says. */
export function sofEmptyCopy(status: SofListStatus): { title: string; description: string } {
  if (status === "rejected") {
    return {
      title: "No rejected cases",
      description:
        "Rejected cases stay blocking until they are reopened when the buyer supplies new evidence.",
    };
  }
  if (status === "approved") {
    return {
      title: "No approved cases",
      description:
        "Approved cases clear the settlement gate for the buyer, subject to validity and exposure limits.",
    };
  }
  return {
    title: "No pending source of funds cases",
    description: "Cases open when a buyer crosses the threshold without a valid approval.",
  };
}

/** "1–50 of 312 cases". */
export function sofRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "case" : "cases";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
