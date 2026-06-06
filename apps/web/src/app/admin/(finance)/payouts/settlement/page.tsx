import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListShell } from "@/components/admin/admin-list-shell";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { PayoutSettlementForm } from "@/components/admin/payout-settlement-form";
import { mapFinanceHubQuickLinks } from "@/lib/admin/finance-hub-links";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Surface } from "@auction/ui/components/surface";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Run settlement",
  "Create a payout from captured payments for one legal entity.",
);

export default async function PayoutSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const sp = await searchParams;
  const success = safeDecodeAdminErrorParam(sp.success);
  const error = safeDecodeAdminErrorParam(sp.error);

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  return (
    <AdminListShell
      layout="hub"
      title="Run settlement"
      description="Run on-demand settlement for one legal entity. Nightly automation handles the rest."
      breadcrumbs={
        <Link
          href="/admin/finance"
          className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:underline"
        >
          ← Finance
        </Link>
      }
      mobileSummary={
        <CatalogListMobileSummary
          metrics={[
            {
              id: "manual-review",
              label: "Manual review",
              value: String(navCounts.manualReviewCount),
            },
            { id: "disputes", label: "Open disputes", value: String(navCounts.disputesOpen) },
            { id: "payouts", label: "Failed payouts", value: String(navCounts.payoutsFailed) },
          ]}
        />
      }
      view={
        <div className="space-y-8">
          {success ? (
            <Alert>
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Settlement failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Surface variant="card">
            <div className="space-y-4 p-4">
              <p className="text-sm text-on-surface-variant">
                Captured payments for eligible sellers are settled automatically each night. Use
                this form when finance needs an immediate payout for a specific legal entity — for
                example after a manual adjustment or before a sale closes.
              </p>
              <p className="text-sm text-on-surface-variant">
                Review existing payouts on{" "}
                <Link href="/admin/payouts" className="text-primary underline">
                  Payouts
                </Link>{" "}
                before running settlement.
              </p>
              <PayoutSettlementForm />
            </div>
          </Surface>
          <AdminHubQuickLinks
            ariaLabel="Finance quick links"
            links={mapFinanceHubQuickLinks(navCounts)}
          />
        </div>
      }
    />
  );
}
