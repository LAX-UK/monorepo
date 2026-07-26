import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import type { AdminFinanceIssuesPayload } from "@/lib/data/http/admin.server";

type Props = {
  financeIssues: AdminFinanceIssuesPayload;
};

/** Finance + onboarding queues as unified KPI bands (finance hub). */
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
        <AdminTrendKpiBand
          ariaLabel="Stripe Connect and payouts"
          tiles={[
            buildSnapshotKpiTile("Failed payouts", financeIssues.failedPayoutCount, 30, {
              compareHint: "Open list",
              semanticTone: financeIssues.failedPayoutCount > 0 ? "danger" : "default",
              trendTone: financeIssues.failedPayoutCount > 0 ? "live-red" : "muted",
            }),
            buildSnapshotKpiTile(
              "Blocked scheduled",
              financeIssues.staleBlockedScheduledPayoutCount,
              30,
              {
                compareHint: "Review scheduled payouts",
                semanticTone:
                  financeIssues.staleBlockedScheduledPayoutCount > 0 ? "warning" : "default",
                trendTone:
                  financeIssues.staleBlockedScheduledPayoutCount > 0 ? "accent-gold" : "muted",
              },
            ),
            buildSnapshotKpiTile(
              "Connect requirements",
              financeIssues.legalEntitiesWithStripeConnectRequirementsCount,
              30,
              {
                compareHint: "View legal entities",
                semanticTone:
                  financeIssues.legalEntitiesWithStripeConnectRequirementsCount > 0
                    ? "warning"
                    : "default",
                trendTone:
                  financeIssues.legalEntitiesWithStripeConnectRequirementsCount > 0
                    ? "accent-gold"
                    : "muted",
              },
            ),
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
        <AdminTrendKpiBand
          ariaLabel="Onboarding and verification issues"
          tiles={[
            buildSnapshotKpiTile(
              "Entities pending",
              financeIssues.entitiesPendingReviewCount ?? 0,
              30,
              { compareHint: "View onboarding issues" },
            ),
            buildSnapshotKpiTile(
              "Artists pending",
              financeIssues.artistsPendingApprovalCount ?? 0,
              30,
              { compareHint: "View artist approvals" },
            ),
            buildSnapshotKpiTile("Stale KYC", financeIssues.staleKycSessionsCount ?? 0, 30, {
              compareHint: "View KYC sessions",
            }),
            buildSnapshotKpiTile(
              "Documents awaiting",
              financeIssues.documentsAwaitingReviewCount ?? 0,
              30,
              { compareHint: "View document queue" },
            ),
            buildSnapshotKpiTile(
              "Stale lead orgs",
              financeIssues.staleLeadOrganisationsCount ?? 0,
              30,
              { compareHint: "View lead organisations" },
            ),
          ]}
        />
      </section>
    </div>
  );
}
