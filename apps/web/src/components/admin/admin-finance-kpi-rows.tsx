import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { AdminFinanceIssuesPayload } from "@/lib/data/http/admin.server";

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
              href: "/admin/payouts?status=failed",
              trendSlot: <span className="text-xs font-semibold text-primary">Open list</span>,
            },
            {
              id: "blocked",
              label: "Blocked scheduled",
              value: String(financeIssues.staleBlockedScheduledPayoutCount),
              semanticTone:
                financeIssues.staleBlockedScheduledPayoutCount > 0 ? "warning" : "default",
              href: "/admin/payouts?status=scheduled",
              trendSlot: <span className="text-xs font-semibold text-primary">Review</span>,
            },
            {
              id: "connect-req",
              label: "Connect requirements",
              value: String(financeIssues.legalEntitiesWithStripeConnectRequirementsCount),
              semanticTone:
                financeIssues.legalEntitiesWithStripeConnectRequirementsCount > 0
                  ? "warning"
                  : "default",
              href: "/admin/legal-entities?stripe=1",
              trendSlot: <span className="text-xs font-semibold text-primary">Entities</span>,
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
              href: "/admin/onboarding-issues#entities-pending-review",
              trendSlot: <span className="text-xs font-semibold text-primary">Queue</span>,
            },
            {
              id: "artists",
              label: "Artists pending",
              value: String(financeIssues.artistsPendingApprovalCount ?? 0),
              href: "/admin/onboarding-issues#artists-pending",
              trendSlot: <span className="text-xs font-semibold text-primary">Queue</span>,
            },
            {
              id: "identity",
              label: "Stale KYC",
              value: String(financeIssues.staleKycSessionsCount ?? 0),
              href: "/admin/onboarding-issues#stale-kyc",
              trendSlot: <span className="text-xs font-semibold text-primary">Queue</span>,
            },
            {
              id: "documents",
              label: "Documents awaiting",
              value: String(financeIssues.documentsAwaitingReviewCount ?? 0),
              href: "/admin/onboarding-issues#documents-awaiting",
              trendSlot: <span className="text-xs font-semibold text-primary">Queue</span>,
            },
            {
              id: "lead-orgs",
              label: "Stale lead orgs",
              value: String(financeIssues.staleLeadOrganisationsCount ?? 0),
              href: "/admin/onboarding-issues#stale-lead-orgs",
              trendSlot: <span className="text-xs font-semibold text-primary">Queue</span>,
            },
          ]}
        />
      </div>
    </div>
  );
}
