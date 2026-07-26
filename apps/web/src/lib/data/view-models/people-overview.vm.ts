import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import type { AdminUserReadinessSnapshot } from "@/lib/admin/admin-user-readiness.vm";
import type { DetailBoardKpiTile } from "@/lib/admin/detail-board/types";
import { daysSinceIso } from "@/lib/admin/relative-time";
import type { AdminPaymentRow } from "@/lib/data/http/admin.server";
import { sumOutstandingPayments } from "@/lib/data/view-models/client-commerce-tab.vm";
import { formatMoney } from "@/lib/format-currency";

type BuildPeopleOverviewInput = {
  summaryMetrics?: AdminUserSummaryMetrics;
  readinessSnapshot?: AdminUserReadinessSnapshot;
  attentionCount?: number;
  payments?: readonly AdminPaymentRow[];
  isStaff?: boolean;
};

export type PeopleOverviewViewModel = {
  kpiTiles: readonly DetailBoardKpiTile[];
};

function formatSpend(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  return formatMoney(value.toFixed(2));
}

function computeProfileCompletion(snapshot: AdminUserReadinessSnapshot | undefined): number {
  if (!snapshot) return 0;
  const checks = [
    snapshot.identity.emailVerified,
    snapshot.identity.kycStatus === "approved",
    snapshot.identity.twoFactorEnabled,
    !snapshot.compliance.amlHoldActive,
    !snapshot.compliance.amlReviewPending,
    snapshot.commerce.connectGapsCount === 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

/** KPI band for client/staff detail overview tabs — catalog DetailBoardKpiStrip language. */
export function buildPeopleOverviewViewModel(
  input: BuildPeopleOverviewInput,
): PeopleOverviewViewModel {
  const {
    summaryMetrics,
    readinessSnapshot,
    attentionCount = 0,
    payments = [],
    isStaff = false,
  } = input;

  if (isStaff) {
    const memberDays = summaryMetrics ? daysSinceIso(summaryMetrics.memberSinceIso) : null;
    return {
      kpiTiles: [
        {
          id: "member",
          label: "Member for",
          value: memberDays == null ? "—" : memberDays === 0 ? "Today" : `${memberDays}d`,
          compareHint: "Since signup",
          trendTone: "secondary",
        },
        {
          id: "entities",
          label: "Connect gaps",
          value: String(readinessSnapshot?.commerce.connectGapsCount ?? 0),
          trendTone:
            (readinessSnapshot?.commerce.connectGapsCount ?? 0) > 0 ? "accent-gold" : "muted",
        },
        {
          id: "attention",
          label: "Open items",
          value: String(attentionCount),
          trendTone: attentionCount > 0 ? "accent-gold" : "muted",
        },
      ],
    };
  }

  if (!summaryMetrics) {
    return { kpiTiles: [] };
  }

  const outstanding = sumOutstandingPayments(payments);
  const completion = computeProfileCompletion(readinessSnapshot);
  const openCases = attentionCount;

  return {
    kpiTiles: [
      {
        id: "lifetime",
        label: "Lifetime value",
        value: formatSpend(summaryMetrics.lifetimeSpend),
        trendTone: summaryMetrics.lifetimeSpend ? "accent-gold" : "muted",
      },
      {
        id: "outstanding",
        label: "Outstanding",
        value: outstanding > 0 ? formatMoney(outstanding.toFixed(2)) : "—",
        ...(outstanding > 0 ? { compareHint: "Payment due" as const } : {}),
        trendTone: outstanding > 0 ? "accent-gold" : "muted",
      },
      {
        id: "completion",
        label: "Completion",
        value: `${completion}%`,
        compareHint: completion >= 100 ? "Profile complete" : "Readiness checklist",
        trendTone: completion >= 100 ? "success" : completion >= 70 ? "secondary" : "accent-gold",
      },
      {
        id: "won",
        label: "Won lots",
        value: summaryMetrics.lotsWon != null ? String(summaryMetrics.lotsWon) : "—",
        trendTone: "secondary",
      },
      {
        id: "cases",
        label: "Open cases",
        value: String(openCases),
        ...(openCases === 0 ? { compareHint: "None" as const } : {}),
        trendTone: openCases > 0 ? "accent-gold" : "muted",
      },
      {
        id: "submissions",
        label: "Submissions",
        value:
          summaryMetrics.submissionsCount != null ? String(summaryMetrics.submissionsCount) : "—",
        trendTone: "secondary",
      },
    ],
  };
}
