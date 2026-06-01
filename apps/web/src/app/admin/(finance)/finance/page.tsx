import { AdminAnomalyBanner } from "@/components/admin/admin-anomaly-banner";
import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminFinanceIssues } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import Link from "next/link";

const FINANCE_QUICK_LINKS = [
  { href: "/admin/payments", label: "Payments" },
  {
    href: "/admin/payments?manualReview=1",
    label: "Manual review",
    countKey: "manualReviewCount" as const,
  },
  { href: "/admin/disputes", label: "Disputes", countKey: "disputesOpen" as const },
  { href: "/admin/payouts", label: "Payouts", countKey: "payoutsFailed" as const },
  { href: "/admin/payouts/settlement", label: "Run settlement" },
  { href: "/admin/integrations/xero", label: "Xero integration" },
] as const;

export const metadata: Metadata = metadataForPrivate(
  "Finance",
  "Payments, payouts, disputes, and accounting integrations.",
);

export default async function FinanceAdminHomePage() {
  let financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null = null;
  let financeIssuesLoadError: string | null = null;
  try {
    financeIssues = await getAdminFinanceIssues();
  } catch (e) {
    financeIssuesLoadError = e instanceof Error ? e.message : "Could not load finance KPI data.";
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
    <AdminListShell
      layout="hub"
      title="Finance"
      description="Payments, payouts, disputes, and accounting integrations."
      showCommandPaletteHint
      mobileSummary={
        <CatalogListMobileSummary
          metrics={[
            {
              id: "manual-review",
              label: "Manual review",
              value: String(navCounts.manualReviewCount),
            },
            { id: "disputes", label: "Open disputes", value: String(navCounts.disputesOpen) },
            {
              id: "payouts",
              label: "Failed payouts",
              value: String(financeIssues?.failedPayoutCount ?? navCounts.payoutsFailed),
            },
          ]}
        />
      }
      kpiStrip={financeIssues ? <AdminFinanceKpiRows financeIssues={financeIssues} /> : null}
      view={
        <div className="space-y-8">
          {anomalies.length > 0 ? (
            <AdminAnomalyBanner anomalies={anomalies} storageKey="finance-home" />
          ) : null}
          {financeIssuesLoadError ? (
            <AdminListAlert title="Could not load finance KPIs">
              {financeIssuesLoadError}
            </AdminListAlert>
          ) : null}
          <section
            aria-label="Finance quick links"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {FINANCE_QUICK_LINKS.map((item) => {
              const count = "countKey" in item && item.countKey ? navCounts[item.countKey] : 0;
              return (
                <Surface
                  key={item.href}
                  variant="quiet"
                  padding="md"
                  className="transition-colors hover:bg-surface-container-high"
                >
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center justify-between gap-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface"
                  >
                    <span>{item.label}</span>
                    {count > 0 ? (
                      <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold text-primary">
                        {count}
                      </span>
                    ) : null}
                  </Link>
                </Surface>
              );
            })}
          </section>
        </div>
      }
    />
  );
}
