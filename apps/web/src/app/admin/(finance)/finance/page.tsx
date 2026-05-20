import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminFinanceIssues } from "@/lib/data/http/admin.server";
import Link from "next/link";

export default async function FinanceAdminHomePage() {
  let financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null = null;
  try {
    financeIssues = await getAdminFinanceIssues();
  } catch {
    financeIssues = null;
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  const anomalies = detectAnomaliesFromNavCounts(navCounts, {
    failedPayouts: financeIssues?.failedPayoutCount ?? 0,
  });

  return (
    <AdminListPage
      title="Finance"
      description="Payments, payouts, disputes, and accounting integrations."
      view={
        <div className="space-y-8">
          {anomalies.length > 0 ? (
            <ul className="space-y-2 font-body text-sm">
              {anomalies.map((a) => (
                <li key={a.id}>
                  {a.href ? (
                    <Link href={a.href} className="text-primary underline-offset-4 hover:underline">
                      {a.message}
                    </Link>
                  ) : (
                    <span>{a.message}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {financeIssues ? <AdminFinanceKpiRows financeIssues={financeIssues} /> : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/admin/payments"
              className="rounded-lg border border-border-hairline p-4 font-label text-sm uppercase tracking-wide hover:bg-surface-container-low"
            >
              Payments
            </Link>
            <Link
              href="/admin/payments?manualReview=1"
              className="rounded-lg border border-border-hairline p-4 font-label text-sm uppercase tracking-wide hover:bg-surface-container-low"
            >
              Manual review
              {navCounts.manualReviewCount > 0 ? ` (${navCounts.manualReviewCount})` : ""}
            </Link>
            <Link
              href="/admin/disputes"
              className="rounded-lg border border-border-hairline p-4 font-label text-sm uppercase tracking-wide hover:bg-surface-container-low"
            >
              Disputes
            </Link>
            <Link
              href="/admin/payouts"
              className="rounded-lg border border-border-hairline p-4 font-label text-sm uppercase tracking-wide hover:bg-surface-container-low"
            >
              Payouts
            </Link>
          </div>
        </div>
      }
    />
  );
}
