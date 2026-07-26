import { AdminBulkSelectionProvider } from "@/components/admin/admin-bulk-selection-bridge";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { AdminUsersFilterToolbar } from "@/components/admin/admin-users-filter-toolbar";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { AdminClientsBoardContainer } from "@/components/admin/clients-board/container";
import {
  AdminUserListBulkBar,
  PeopleClientsMobileCards,
} from "@/components/admin/people/people-users-mobile-cards";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ExportButton } from "@/components/exports/export-button";
import {
  buildClientsListKpiTiles,
  buildClientsMobileMetrics,
} from "@/lib/admin/people/build-clients-list-kpi-tiles";
import { loadAdminClientsListPage } from "@/lib/admin/people/load-clients-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Clients",
  "Browse collector and seller accounts.",
);

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const { model, rows, summary, total, loadError, pagination } = await loadAdminClientsListPage(sp);
  const isPaginationEmpty = !loadError && total > 0 && rows.length === 0 && !model.hasFilters;

  return (
    <AdminBulkSelectionProvider>
      <CatalogListShell
        title="Clients"
        description="Browse collector and seller accounts. Filter by verification, KYC, persona, activity dates, and more."
        hasFilters={model.hasFilters}
        resetHref={model.basePath}
        bulkBar={<AdminUserListBulkBar />}
        mobileCards={
          !loadError && rows.length > 0 ? <PeopleClientsMobileCards rows={rows} /> : null
        }
        mobileSummary={
          !loadError ? (
            <CatalogListMobileSummary metrics={buildClientsMobileMetrics(summary)} />
          ) : null
        }
        kpiStrip={
          !loadError ? (
            <AdminTrendKpiBand
              ariaLabel="Client summary"
              tiles={buildClientsListKpiTiles(summary)}
            />
          ) : null
        }
        errorAlert={
          error || loadError ? (
            <AdminListAlert title="Could not load clients">{loadError ?? error}</AdminListAlert>
          ) : null
        }
        filters={
          !loadError ? (
            <AdminUsersFilterToolbar
              filterDefaults={model.listFilters}
              activeFilterCount={model.activeFilterCount}
              activeFilterChips={model.activeFilterChips}
              toolbarEnd={<ExportButton entityType="clients" filters={model.exportFilters} />}
            />
          ) : null
        }
        filtersSelfContained
        empty={
          !loadError && rows.length === 0 ? (
            <FilterEmptyState
              entity="clients"
              segment="admin"
              hasActiveFilters={model.hasFilters}
              clearFiltersHref={model.basePath}
              {...(isPaginationEmpty
                ? {
                    title: "No clients on this page",
                    description: "Try a previous page or adjust pagination.",
                  }
                : !model.hasFilters
                  ? {
                      description: "Client accounts will appear here once users sign up.",
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
          <AdminClientsBoardContainer
            rows={rows}
            totalMatches={total}
            hasActiveFilters={model.hasFilters}
            selectedClientId={model.selectedClientId}
            listReturnTarget={model.listReturnTarget}
            clearPreviewHref={model.buildDrawerHref(null)}
            externalMobileCards
          />
        ) : null}
      </CatalogListShell>
    </AdminBulkSelectionProvider>
  );
}
