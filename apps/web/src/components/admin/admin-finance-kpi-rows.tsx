import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { AdminFinanceIssuesPayload } from "@/lib/data/http/admin.server";
import Link from "next/link";

type Props = {
  financeIssues: AdminFinanceIssuesPayload;
};

/** Finance + onboarding queues as `KpiRow` bands (replaces linked-number cards). */
export function AdminFinanceKpiRows({ financeIssues }: Props) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-3">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          Stripe Connect &amp; payouts
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          Failed transfers, blocked scheduled payouts, and outstanding Connect requirements.
        </p>
        <KpiRow
          columns={4}
          className="xl:grid-cols-3"
          aria-label="Stripe Connect and payouts"
          tiles={[
            {
              id: "failed-payouts",
              label: "Failed payouts",
              value: String(financeIssues.failedPayoutCount),
              semanticTone: financeIssues.failedPayoutCount > 0 ? "danger" : "default",
              trendSlot: (
                <Link
                  href="/admin/payouts?status=failed"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open list
                </Link>
              ),
            },
            {
              id: "blocked",
              label: "Blocked scheduled",
              value: String(financeIssues.staleBlockedScheduledPayoutCount),
              semanticTone:
                financeIssues.staleBlockedScheduledPayoutCount > 0 ? "warning" : "default",
              trendSlot: (
                <Link
                  href="/admin/payouts?status=scheduled"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Review
                </Link>
              ),
            },
            {
              id: "connect-req",
              label: "Connect requirements",
              value: String(financeIssues.legalEntitiesWithStripeConnectRequirementsCount),
              semanticTone:
                financeIssues.legalEntitiesWithStripeConnectRequirementsCount > 0
                  ? "warning"
                  : "default",
              trendSlot: (
                <Link
                  href="/admin/legal-entities?stripe=1"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Entities
                </Link>
              ),
            },
          ]}
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          Onboarding &amp; verification
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          KYB/KYC queues with drill-down lists.
        </p>
        <KpiRow
          columns={6}
          className="xl:grid-cols-3"
          aria-label="Onboarding and verification queues"
          tiles={[
            {
              id: "entities",
              label: "Entities pending",
              value: String(financeIssues.entitiesPendingReviewCount ?? 0),
              trendSlot: (
                <Link
                  href="/admin/onboarding-issues#entities-pending-review"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Queue
                </Link>
              ),
            },
            {
              id: "artists",
              label: "Artists pending",
              value: String(financeIssues.artistsPendingApprovalCount ?? 0),
              trendSlot: (
                <Link
                  href="/admin/onboarding-issues#artists-pending"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Queue
                </Link>
              ),
            },
            {
              id: "identity",
              label: "Stale Identity",
              value: String(financeIssues.staleIdentitySessionsCount ?? 0),
              trendSlot: (
                <Link
                  href="/admin/onboarding-issues#stale-identity"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Queue
                </Link>
              ),
            },
            {
              id: "documents",
              label: "Documents awaiting",
              value: String(financeIssues.documentsAwaitingReviewCount ?? 0),
              trendSlot: (
                <Link
                  href="/admin/onboarding-issues#documents-awaiting"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Queue
                </Link>
              ),
            },
            {
              id: "lead-orgs",
              label: "Stale lead orgs",
              value: String(financeIssues.staleLeadOrganisationsCount ?? 0),
              trendSlot: (
                <Link
                  href="/admin/onboarding-issues#stale-lead-orgs"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Queue
                </Link>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
