import { AdminBulkSelectionProvider } from "@/components/admin/admin-bulk-selection-bridge";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminStaffFilterToolbar } from "@/components/admin/admin-staff-filter-toolbar";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import {
  AdminUserListBulkBar,
  PeopleStaffMobileCards,
} from "@/components/admin/people/people-users-mobile-cards";
import { AdminStaffBoardContainer } from "@/components/admin/staff-board/container";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import {
  buildStaffListKpiTiles,
  buildStaffMobileMetrics,
} from "@/lib/admin/people/build-staff-list-kpi-tiles";
import { loadAdminStaffListPage } from "@/lib/admin/people/load-staff-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Staff",
  "Internal team directory and staff role management.",
);

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const { model, rows, summary, total, loadError, pagination } = await loadAdminStaffListPage(sp);
  const isPaginationEmpty = !loadError && total > 0 && rows.length === 0 && !model.hasFilters;

  return (
    <AdminBulkSelectionProvider>
      <CatalogListShell
        title="Staff"
        description="Internal team directory. Filter by staff role or suspension, and manage capabilities from each profile."
        hasFilters={model.hasFilters}
        resetHref={model.basePath}
        bulkBar={<AdminUserListBulkBar />}
        filtersSelfContained
        mobileCards={!loadError && rows.length > 0 ? <PeopleStaffMobileCards rows={rows} /> : null}
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary metrics={buildStaffMobileMetrics(summary)} />
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminTrendKpiBand ariaLabel="Staff summary" tiles={buildStaffListKpiTiles(summary)} />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load staff">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        filters={
          !loadError ? (
            <AdminStaffFilterToolbar
              activeFilterCount={model.activeFilterCount}
              activeFilterChips={model.activeFilterChips}
            />
          ) : null
        }
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="staff"
              segment="admin"
              hasActiveFilters={model.hasFilters}
              clearFiltersHref={model.basePath}
              {...(isPaginationEmpty
                ? {
                    title: "No staff on this page",
                    description: "Try a previous page or adjust pagination.",
                  }
                : {})}
            />
          ) : null
        }
        pagination={
          pagination ? (
            <CatalogPagination
              offset={pagination.offset}
              limit={pagination.limit}
              countOnPage={pagination.countOnPage}
              total={pagination.total}
              prevHref={pagination.prevHref}
              nextHref={pagination.nextHref}
            />
          ) : null
        }
      >
        {!loadError && rows.length > 0 ? (
          <AdminStaffBoardContainer
            rows={rows}
            totalMatches={total}
            hasActiveFilters={model.hasFilters}
            selectedStaffId={model.selectedStaffId}
            listReturnTarget={model.listReturnTarget}
            clearPreviewHref={model.buildDrawerHref(null)}
            externalMobileCards
          />
        ) : null}
      </CatalogListShell>
    </AdminBulkSelectionProvider>
  );
}
