import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";

export type AdminAnomalySeverity = "info" | "warning" | "critical";

export type AdminAnomaly = {
  id: string;
  severity: AdminAnomalySeverity;
  message: string;
  href?: string;
};

const DEFAULT_BASELINES: Record<string, number> = {
  stalePendingPayments: 3,
  pendingSubmissions: 12,
  manualReviewCount: 1,
  clawbackPending: 1,
  failedPayouts: 0,
  awaitingCaptureVolume: 5000,
  payoutsFailed: 0,
  disputesOpen: 0,
  conditionReportsPending: 5,
  onboardingIssuesTotal: 20,
};

function ratio(current: number, baseline: number): number {
  if (baseline <= 0) return current > 0 ? Number.POSITIVE_INFINITY : 0;
  return current / baseline;
}

/**
 * Flags metrics that exceed optional baselines or known safe thresholds.
 * Pass finance/ops counters from list pages or the staff home dashboard.
 */
export function detectAnomalies(
  metrics: Record<string, number>,
  baselines?: Record<string, number>,
): AdminAnomaly[] {
  const merged = { ...DEFAULT_BASELINES, ...baselines };
  const anomalies: AdminAnomaly[] = [];

  const push = (id: string, severity: AdminAnomalySeverity, message: string, href?: string) => {
    anomalies.push({ id, severity, message, ...(href ? { href } : {}) });
  };

  const stale = metrics.stalePendingPayments ?? 0;
  if (stale > 0 && ratio(stale, merged.stalePendingPayments ?? 3) >= 1) {
    push(
      "stale-payments",
      stale >= (merged.stalePendingPayments ?? 3) * 2 ? "critical" : "warning",
      `${stale} payment${stale === 1 ? "" : "s"} pending more than 48 hours`,
      "/admin/payments?status=pending",
    );
  }

  const submissions = metrics.pendingSubmissions ?? metrics.submissionsPending ?? 0;
  if (submissions > (merged.pendingSubmissions ?? 12)) {
    push(
      "submission-backlog",
      submissions > (merged.pendingSubmissions ?? 12) * 1.5 ? "warning" : "info",
      `${submissions} submissions awaiting specialist review`,
      "/admin/submissions",
    );
  }

  const manual = metrics.manualReviewCount ?? 0;
  if (manual > (merged.manualReviewCount ?? 1)) {
    push(
      "manual-review",
      "warning",
      `${manual} payment${manual === 1 ? "" : "s"} need manual review before capture`,
      "/admin/payments?manualReview=1",
    );
  } else if (manual > 0) {
    push(
      "manual-review",
      "critical",
      `${manual} payment${manual === 1 ? "" : "s"} awaiting manual review`,
      "/admin/payments?manualReview=1",
    );
  }

  const clawback = metrics.clawbackPending ?? 0;
  if (clawback > (merged.clawbackPending ?? 1)) {
    push(
      "clawback-pending",
      "warning",
      `${clawback} payout${clawback === 1 ? "" : "s"} in clawback pending`,
      "/admin/payouts?status=clawback_pending",
    );
  }

  const failed = (metrics.failedPayouts ?? 0) + (metrics.payoutsFailed ?? 0);
  if (failed > (merged.failedPayouts ?? 0)) {
    push(
      "failed-payouts",
      failed > 2 ? "critical" : "warning",
      `${failed} payout${failed === 1 ? "" : "s"} failed or reversed`,
      "/admin/payouts?status=failed",
    );
  }

  const disputes = metrics.disputesOpen ?? 0;
  if (disputes > 0) {
    push(
      "disputes-open",
      "critical",
      `${disputes} open dispute${disputes === 1 ? "" : "s"} need resolution`,
      "/admin/disputes",
    );
  }

  const condition = metrics.conditionReportsPending ?? 0;
  if (condition > (merged.conditionReportsPending ?? 5)) {
    push(
      "condition-reports",
      "warning",
      `${condition} condition reports pending review`,
      "/admin/condition-reports",
    );
  }

  const onboarding = metrics.onboardingIssuesTotal ?? 0;
  if (onboarding > (merged.onboardingIssuesTotal ?? 20)) {
    push(
      "onboarding-issues",
      "warning",
      `${onboarding} onboarding issues in the queue`,
      "/admin/onboarding-issues",
    );
  }

  const awaiting = metrics.awaitingCaptureVolume ?? 0;
  if (awaiting > (merged.awaitingCaptureVolume ?? 5000)) {
    push(
      "awaiting-capture",
      "info",
      "High volume of payments awaiting capture on this page",
      "/admin/payments",
    );
  }

  return anomalies;
}

/** Map nav badge counts + optional extras into {@link detectAnomalies}. */
export function detectAnomaliesFromNavCounts(
  counts: AdminNavCounts,
  extra: Record<string, number> = {},
  baselines?: Record<string, number>,
): AdminAnomaly[] {
  return detectAnomalies(
    {
      manualReviewCount: counts.manualReviewCount,
      payoutsFailed: counts.payoutsFailed,
      disputesOpen: counts.disputesOpen,
      conditionReportsPending: counts.conditionReportsPending,
      onboardingIssuesTotal: counts.onboardingIssuesTotal,
      pendingSubmissions: counts.submissionsPending,
      ...extra,
    },
    baselines,
  );
}
