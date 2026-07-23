import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogConditionReportsFilterToolbar } from "@/components/admin/catalog/catalog-condition-reports-filter-toolbar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { AdminConditionReportsBoardContainer } from "@/components/admin/condition-reports-board/container";
import {
  buildConditionReportsListKpiTiles,
  buildConditionReportsMobileMetrics,
} from "@/lib/admin/build-condition-reports-list-kpi-tiles";
import { buildConditionReportsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { loadAdminConditionReportsListPage } from "@/lib/admin/load-condition-reports-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { CONDITION_REPORTS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Condition report requests",
  "Respond to buyer condition report requests.",
);

type Props = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    limit?: string;
    offset?: string;
    lens?: string;
    request?: string;
  }>;
};

export default async function AdminConditionReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminCapability(CONDITION_REPORTS_ACCESS, "/admin/condition-reports");

  const loaded = await loadAdminConditionReportsListPage(sp);
  const { model, rows, summary, total, loadError, pagination } = loaded;
  const error = safeDecodeAdminErrorParam(sp.error);
  const success = safeDecodeAdminErrorParam(sp.success);
  const activeLensId = model.query.lens;
  const activeFilterChips = buildConditionReportsActiveFilterChips(sp, {
    activeLens: activeLensId,
  });

  const filterBar = (
    <Suspense
      fallback={
        <div
          className="min-h-[3.25rem] rounded-md border border-border-hairline bg-surface-container-low/40"
          aria-hidden
        />
      }
    >
      <CatalogConditionReportsFilterToolbar
        activeLensId={activeLensId}
        searchParams={sp}
        activeFilterChips={activeFilterChips}
      />
    </Suspense>
  );

  return (
    <CatalogListShell
      title="Condition report requests"
      description="Buyer-requested condition reports. Fulfilling publishes the PDF copy block on the public lot page."
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Admin", href: "/admin" }, { label: "Condition reports" }]}
        />
      }
      filterBar={filterBar}
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Condition reports summary"
            tiles={buildConditionReportsListKpiTiles({
              summary,
              activeLensId,
              matchingTotal: total,
            })}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load condition reports">
            {loadError ?? error}
          </AdminListAlert>
        ) : null
      }
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={buildConditionReportsMobileMetrics({
              summary,
              matchingTotal: total,
              pageCount: rows.length,
            })}
          />
        ) : null
      }
      empty={
        !loadError && total === 0 ? (
          <CatalogListEmptyState
            title="No open requests"
            description={
              activeLensId === "open"
                ? "No pending or in-progress condition report requests."
                : "No requests match this lens."
            }
          />
        ) : !loadError && rows.length === 0 ? (
          <CatalogListEmptyState
            title="No rows on this page"
            description="Try the previous page or switch lenses."
          />
        ) : null
      }
    >
      {!loadError && rows.length > 0 ? (
        <div className="space-y-4">
          {success ? (
            <Alert>
              <AlertTitle>Condition report updated</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}
          <AdminConditionReportsBoardContainer
            rows={rows}
            selectedRequestId={model.selectedRequestId}
            pagination={pagination}
          />
        </div>
      ) : null}
    </CatalogListShell>
  );
}
