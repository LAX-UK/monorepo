import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogListPageSkeleton } from "@/components/admin/catalog/catalog-list-states";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogSalesFilterToolbar } from "@/components/admin/catalog/catalog-sales-filter-toolbar";
import { AdminSalesBoard } from "@/components/admin/sales-board";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { buildSalesListKpiTiles } from "@/lib/admin/sales/build-sales-list-kpi-tiles";
import { loadAdminSalesListPage } from "@/lib/admin/sales/load-sales-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SALES_ACCESS, SALE_CATALOG_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { Button } from "@auction/ui";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Sales",
  "Plan, publish, and manage auctions.",
);

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    lifecycle?: string;
    lens?: string;
    delivery?: string;
    q?: string;
    error?: string;
    limit?: string;
    offset?: string;
    sort?: string;
    period?: string;
  }>;
}) {
  const user = await requireAdminCapability(SALE_CATALOG_ACCESS, "/admin/sales");
  const canManageSales = userHasAccessTo(
    user.role as UserRole,
    user.staffRole ?? null,
    SALES_ACCESS,
  );
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const {
    periodDays,
    model,
    salesSummary,
    salesTrend,
    salesHammerTrend,
    err,
    boardRows,
    lensesItems,
    activeFilterCount,
    activeFilterChips,
    boardPagination,
    listPaginationTotal,
  } = await loadAdminSalesListPage(sp);
  const {
    lifecycleSlug,
    deliveryFilter,
    activeLensId,
    hasListFilters,
    salesEmptyDescription,
    columnSort,
    exportFilters,
    presetLabels: PRESET_LABELS,
  } = model;

  const empty =
    !err && boardRows.length === 0 ? (
      <CatalogListEmptyState
        title={hasListFilters ? "No matching sales" : "No sales yet"}
        description={
          hasListFilters
            ? salesEmptyDescription
            : "Create a sale to group lots for a session or season."
        }
        action={
          hasListFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/sales">Clear filters</Link>
            </Button>
          ) : canManageSales ? (
            <CatalogPrimaryCta href="/admin/sales/new" icon={Plus}>
              New sale
            </CatalogPrimaryCta>
          ) : null
        }
      />
    ) : null;

  const kpiStrip = (
    <AdminTrendKpiBand
      ariaLabel="Sales summary"
      tiles={buildSalesListKpiTiles({
        summary: salesSummary,
        salesTrend,
        salesHammerTrend,
        periodDays,
      })}
      toolbarEnd={
        <Suspense fallback={null}>
          <CatalogKpiPeriodToggle current={periodDays} />
        </Suspense>
      }
    />
  );

  return (
    <CatalogListShell
      title="Sales"
      description="Manage auction sales, organize lots, publish events, and monitor every sale throughout its lifecycle."
      breadcrumbs={
        <CatalogBreadcrumbs segments={[{ label: "Admin", href: "/admin" }, { label: "Sales" }]} />
      }
      primaryAction={
        canManageSales ? (
          <CatalogPrimaryCta href="/admin/sales/new" icon={Plus}>
            New Sale
          </CatalogPrimaryCta>
        ) : undefined
      }
      filterBar={
        <CatalogSalesFilterToolbar
          lenses={lensesItems}
          activeLensId={activeLensId}
          activeFilterChips={activeFilterChips}
        />
      }
      mobileSummary={
        <div className="space-y-3">
          <CatalogListMobileSummary
            metrics={[
              { id: "page", label: "On page", value: String(boardRows.length) },
              { id: "live", label: "Live", value: String(salesSummary.activeCount) },
              { id: "upcoming", label: "Upcoming", value: String(salesSummary.upcomingCount) },
              { id: "draft", label: "Draft", value: String(salesSummary.draftCount) },
              ...(activeLensId !== "all"
                ? [
                    {
                      id: "lens",
                      label: "Lens",
                      value: PRESET_LABELS[activeLensId],
                    },
                  ]
                : []),
            ]}
          />
          <Suspense fallback={null}>
            <CatalogKpiPeriodToggle current={periodDays} className="lg:hidden" />
          </Suspense>
        </div>
      }
      kpiStrip={kpiStrip}
      errorAlert={
        err || error ? (
          <AdminListAlert title="Could not load sales">{err ?? error}</AdminListAlert>
        ) : null
      }
      empty={empty}
    >
      {!err && boardRows.length > 0 ? (
        <Suspense fallback={<CatalogListPageSkeleton title="Sales" kpiTiles={6} />}>
          <AdminSalesBoard
            rows={boardRows}
            canManageSales={canManageSales}
            listError={err}
            columnSort={columnSort}
            filterControls={{
              searchPlaceholder: "Search by sale title…",
              sheetTitle: "Sale filters",
              activeFilterCount,
              searchInputId: "admin-sales-table-search",
            }}
            saleFilterSheet={{
              activeLensId,
              ...(lifecycleSlug ? { lifecycle: lifecycleSlug } : {}),
              ...(deliveryFilter ? { delivery: deliveryFilter } : {}),
              ...(model.sort ? { sort: model.sort } : {}),
            }}
            exportFilters={exportFilters}
            pagination={boardPagination}
            listTotalCount={listPaginationTotal ?? salesSummary.lensCounts.all}
          />
        </Suspense>
      ) : null}
    </CatalogListShell>
  );
}
