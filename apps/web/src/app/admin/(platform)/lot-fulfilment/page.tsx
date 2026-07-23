import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotFulfilmentFilterToolbar } from "@/components/admin/catalog/catalog-lot-fulfilment-filter-toolbar";
import { AdminLotFulfilmentBoardContainer } from "@/components/admin/lot-fulfilment-board/container";
import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  buildLotFulfilmentListKpiTiles,
  buildLotFulfilmentMobileMetrics,
} from "@/lib/admin/build-lot-fulfilment-list-kpi-tiles";
import { buildFulfilmentActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { loadAdminLotFulfilmentListPage } from "@/lib/admin/load-lot-fulfilment-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOT_FULFILMENT_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Lot fulfilment",
  "Release, shipping, and collection workflow for sold lots.",
);

type Props = {
  searchParams: Promise<{
    error?: string;
    status?: string;
    q?: string;
    limit?: string;
    offset?: string;
    lot?: string;
  }>;
};

export default async function AdminLotFulfilmentQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  await requireAdminCapability(LOT_FULFILMENT_ACCESS, "/admin/lot-fulfilment");

  const loaded = await loadAdminLotFulfilmentListPage(sp);
  const { model, rows, summary, total, loadError, pagination } = loaded;
  const error = safeDecodeAdminErrorParam(sp.error);
  const activeFilterChips = buildFulfilmentActiveFilterChips(sp, {
    ...(model.query.status ? { status: model.query.status } : {}),
    ...(model.query.q ? { q: model.query.q } : {}),
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
      <CatalogLotFulfilmentFilterToolbar
        activeStatus={model.query.status}
        searchParams={sp}
        activeFilterChips={activeFilterChips}
      />
    </Suspense>
  );

  const searchHint =
    model.query.q && !model.query.status && total >= 25 ? (
      <AdminListAlert title="Many matches">
        Add a status filter to narrow fulfilment search results.
      </AdminListAlert>
    ) : null;

  return (
    <CatalogListShell
      title="Lot fulfilment"
      description="After payment is captured, approve release, then ship or mark ready for collection."
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Admin", href: "/admin" }, { label: "Lot fulfilment" }]}
        />
      }
      filterBar={filterBar}
      errorAlert={
        loadError || error ? (
          <>
            {searchHint}
            <AdminListAlert
              title={loadError === "Access denied" ? "Access denied" : "Action failed"}
            >
              {loadError ?? error}
            </AdminListAlert>
          </>
        ) : (
          searchHint
        )
      }
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Fulfilment summary"
            tiles={buildLotFulfilmentListKpiTiles(summary)}
          />
        ) : null
      }
      mobileSummary={
        !loadError && total > 0 ? (
          <CatalogListMobileSummary metrics={buildLotFulfilmentMobileMetrics(summary)} />
        ) : null
      }
      empty={
        !loadError && total === 0 ? (
          <CatalogListEmptyState
            title="Nothing in this view"
            description={
              model.query.status || model.query.q
                ? "No lots match this filter. Try another status, search term, or clear filters."
                : "No fulfilment rows yet."
            }
            action={
              model.query.status || model.query.q ? (
                <Button variant="secondary" asChild>
                  <Link href="/admin/lot-fulfilment">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : !loadError && rows.length === 0 ? (
          <CatalogListEmptyState
            title="No rows on this page"
            description="Try the previous page or clear filters — results may have shifted."
            action={
              <Button variant="secondary" asChild>
                <Link
                  href={buildListHref("/admin/lot-fulfilment", sp, {
                    offset: Math.max(0, model.query.offset - model.query.limit),
                  })}
                >
                  Previous page
                </Link>
              </Button>
            }
          />
        ) : null
      }
    >
      {!loadError && rows.length > 0 ? (
        <AdminLotFulfilmentBoardContainer
          rows={rows}
          selectedLotId={model.selectedLotId}
          returnStatus={model.returnStatus}
          pagination={pagination}
        />
      ) : null}
    </CatalogListShell>
  );
}
