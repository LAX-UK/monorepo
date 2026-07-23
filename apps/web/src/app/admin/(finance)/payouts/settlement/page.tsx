import { AdminHubQuickLinks } from "@/components/admin/admin-hub-quick-links";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { PayoutSettlementWorkspace } from "@/components/admin/payout-settlement-workspace";
import { mapFinanceHubQuickLinks } from "@/lib/admin/finance-hub-links";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminSettlementPreview } from "@/lib/data/http/admin-payouts.reader";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Run settlement",
  "Create a payout from captured payments for one legal entity.",
);

async function loadSettlementPreview(legalEntityId: string) {
  "use server";
  return getAdminSettlementPreview(legalEntityId);
}

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
    <CatalogListShell
      variant="queue"
      title="Run settlement"
      description="Run on-demand settlement for one legal entity. Nightly automation handles the rest."
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[
            { label: "Finance", href: "/admin/finance" },
            { label: "Payouts", href: "/admin/payouts" },
            { label: "Run settlement" },
          ]}
        />
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
      errorAlert={error ? <AdminListAlert title="Settlement failed">{error}</AdminListAlert> : null}
    >
      <div className="space-y-8">
        {success ? (
          <Alert>
            <AlertTitle>Done</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}
        <PayoutSettlementWorkspace loadPreview={loadSettlementPreview} />
        <AdminHubQuickLinks
          ariaLabel="Finance quick links"
          links={mapFinanceHubQuickLinks(navCounts)}
        />
      </div>
    </CatalogListShell>
  );
}
