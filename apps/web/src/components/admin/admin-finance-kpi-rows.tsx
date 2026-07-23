import { KpiRow } from "@/components/dashboard/primitives/kpi-row";
import type { AdminFinanceIssuesPayload } from "@/lib/data/http/admin.server";

type Props = {
  financeIssues: AdminFinanceIssuesPayload;
};

/** Finance + onboarding queues as full-width `KpiRow` bands (finance hub). */
export function AdminFinanceKpiRows({ financeIssues }: Props) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          Stripe Connect &amp; payouts
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          Failed transfers, blocked scheduled payouts, and outstanding Connect requirements.
        </p>
        <KpiRow
          columns={4}
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
              trendSlot: <span className="text-xs font-semibold text-primary">View entities</span>,
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="font-headline text-lg font-semibold text-on-surface">
          Onboarding &amp; verification
        </h3>
        <p className="font-body text-sm text-on-surface-variant">
          KYB/KYC verification items with drill-down lists.
        </p>
        <KpiRow
          columns={5}
          aria-label="Onboarding and verification issues"
          tiles={[
            {
              id: "entities",
              label: "Entities pending",
              value: String(financeIssues.entitiesPendingReviewCount ?? 0),
              href: "/admin/onboarding-issues?tab=entities",
              trendSlot: <span className="text-xs font-semibold text-primary">View issues</span>,
            },
            {
              id: "artists",
              label: "Artists pending",
              value: String(financeIssues.artistsPendingApprovalCount ?? 0),
              href: "/admin/onboarding-issues?tab=artists",
              trendSlot: <span className="text-xs font-semibold text-primary">View issues</span>,
            },
            {
              id: "identity",
              label: "Stale KYC",
              value: String(financeIssues.staleKycSessionsCount ?? 0),
              href: "/admin/onboarding-issues?tab=kyc",
              trendSlot: <span className="text-xs font-semibold text-primary">View issues</span>,
            },
            {
              id: "documents",
              label: "Documents awaiting",
              value: String(financeIssues.documentsAwaitingReviewCount ?? 0),
              href: "/admin/onboarding-issues?tab=documents",
              trendSlot: <span className="text-xs font-semibold text-primary">View issues</span>,
            },
            {
              id: "lead-orgs",
              label: "Stale lead orgs",
              value: String(financeIssues.staleLeadOrganisationsCount ?? 0),
              href: "/admin/onboarding-issues?tab=orgs",
              trendSlot: <span className="text-xs font-semibold text-primary">View issues</span>,
            },
          ]}
        />
      </section>
    </div>
  );
}
