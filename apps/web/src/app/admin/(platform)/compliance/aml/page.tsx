import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { ComplianceAmlBoardContainer } from "@/components/admin/compliance-aml-board/container";
import {
  buildAmlListKpiTiles,
  buildAmlMobileMetrics,
} from "@/lib/admin/compliance/build-aml-list-kpi-tiles";
import { loadAdminAmlListPage } from "@/lib/admin/compliance/load-aml-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { complianceQueueCrossLinksMeta } from "@/lib/admin/sof-list-query";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import Link from "next/link";

const complianceBreadcrumbs = (
  <CatalogBreadcrumbs
    segments={[
      { label: "Compliance", href: "/admin/compliance/aml" },
      { label: "AML / sanctions" },
    ]}
  />
);

export default async function AdminComplianceAmlPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
    limit?: string;
    offset?: string;
    screening?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireAdminCapability(AML_REVIEW_ACCESS, "/admin/compliance/aml");

  const loaded = await loadAdminAmlListPage(sp, user);
  const { model, rows, selected, summary, loadError, capabilities, pagination } = loaded;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);
  const { sofHref, paymentsHref } = complianceQueueCrossLinksMeta();

  const meta = (
    <p className="font-body text-sm text-on-surface-variant">
      Also see{" "}
      <Link href={sofHref} className="text-link underline">
        Source of Funds cases
      </Link>{" "}
      and payments held for{" "}
      <Link href={paymentsHref} className="text-link underline">
        manual review
      </Link>
      .
    </p>
  );

  return (
    <CatalogListShell
      variant="queue"
      title="AML / sanctions screening"
      description="Two-stage maker-checker: analyst triage (advisory), then a different MLRO binding clear/block. Cleared screenings lift settlement holds."
      breadcrumbs={complianceBreadcrumbs}
      meta={meta}
      mobileSummary={
        !loadError && loaded.total > 0 ? (
          <CatalogListMobileSummary metrics={buildAmlMobileMetrics(summary)} />
        ) : null
      }
      kpiStrip={
        !loadError && loaded.total > 0 ? (
          <AdminTrendKpiBand
            ariaLabel="AML screenings summary"
            tiles={buildAmlListKpiTiles(summary)}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load">{loadError ?? error}</AdminListAlert>
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <CatalogListEmptyState
            title="No pending AML screenings"
            description="Watchlist matches awaiting triage will appear here. Escalations are also emailed to compliance officers."
          />
        ) : null
      }
    >
      {!loadError && rows.length > 0 ? (
        <div className="space-y-4">
          {success ? (
            <Alert>
              <AlertTitle>Done</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}
          <ComplianceAmlBoardContainer
            rows={rows}
            selected={selected}
            selectedScreeningId={model.selectedScreeningId}
            pagination={pagination}
            capabilities={capabilities}
          />
        </div>
      ) : null}
    </CatalogListShell>
  );
}
