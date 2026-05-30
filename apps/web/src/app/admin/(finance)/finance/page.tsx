import { AdminFinanceKpiRows } from "@/components/admin/admin-finance-kpi-rows";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminFinanceIssues } from "@/lib/data/http/admin.server";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

const FINANCE_QUICK_LINKS = [
  { href: "/admin/payments", label: "Payments" },
  {
    href: "/admin/payments?manualReview=1",
    label: "Manual review",
    countKey: "manualReviewCount" as const,
  },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/integrations/xero", label: "Xero integration" },
] as const;

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
