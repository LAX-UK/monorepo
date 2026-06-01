import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotFulfilmentFilterToolbar } from "@/components/admin/catalog/catalog-lot-fulfilment-filter-toolbar";
import { CatalogOpsBreadcrumb } from "@/components/admin/catalog/catalog-ops-breadcrumb";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogRelatedWork } from "@/components/admin/catalog/catalog-related-work";
import { AdminLotFulfilmentBoard } from "@/components/admin/lot-fulfilment-board";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildFulfilmentActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Lot fulfilment",
  "Release, shipping, and collection workflow for sold lots.",
);

const FILTER_STATUSES = [
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

function parseStatusFilter(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (FILTER_STATUSES as readonly string[]).includes(raw) ? raw : undefined;
}

type Props = {
  searchParams: Promise<{
    error?: string;
    status?: string;
    q?: string;
    limit?: string;
    offset?: string;
  }>;
};

export default async function AdminLotFulfilmentQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const statusFilter = parseStatusFilter(typeof sp.status === "string" ? sp.status : undefined);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const error = safeDecodeAdminErrorParam(sp.error);
  const navCounts = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);
  const activeFilterChips = buildFulfilmentActiveFilterChips(sp, {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q ? { q } : {}),
  });

  const limit = Math.min(100, Math.max(1, Number(sp.limit) || 25));
  const offset = Math.max(0, Number(sp.offset) || 0);

  const loaded = await loadAdminLotFulfilmentQueue({
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(q ? { q } : {}),
    limit,
    offset,
  });

  if (loaded.access === "forbidden") {
    return (
      <CatalogListShell
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={
          <AdminListAlert title="Access denied">
            Your account does not have the operations fulfilment staff role.
          </AdminListAlert>
        }
      >
        {null}
      </CatalogListShell>
    );
  }

  if (loaded.access === "error") {
    return (
      <CatalogListShell
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={<AdminListAlert title="Could not load queue">{loaded.message}</AdminListAlert>}
      >
        {null}
      </CatalogListShell>
    );
  }

  const rows = loaded.rows;
  const total = loaded.total;
  const returnStatus = statusFilter ?? "";
  const statusCounts = loaded.statusCounts;

  const awaitingPickup =
    (statusCounts.ready_for_collection ?? 0) + (statusCounts.awaiting_release ?? 0);
  const inTransit = (statusCounts.in_transit ?? 0) + (statusCounts.released ?? 0);

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
        activeStatus={statusFilter}
        searchParams={sp}
        activeFilterChips={activeFilterChips}
      />
    </Suspense>
  );

  const errorAlert = error ? <AdminListAlert title="Action failed">{error}</AdminListAlert> : null;

  const searchHint =
    q && !statusFilter && total >= 25 ? (
      <AdminListAlert title="Many matches">
        Add a status filter to narrow fulfilment search results.
      </AdminListAlert>
    ) : null;

  const pagination =
    total > 0 && (offset > 0 || offset + rows.length < total) ? (
      <CatalogPagination
        offset={offset}
        limit={limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          offset > 0
            ? buildListHref("/admin/lot-fulfilment", sp, {
                offset: Math.max(0, offset - limit),
              })
            : null
        }
        nextHref={
          offset + rows.length < total
            ? buildListHref("/admin/lot-fulfilment", sp, { offset: offset + limit })
            : null
        }
      />
    ) : null;

  const empty =
    total === 0 ? (
      <CatalogListEmptyState
        title="Nothing in this view"
        description={
          statusFilter || q
            ? "No lots match this filter. Try another status, search term, or clear filters."
            : "No fulfilment rows yet."
        }
        action={
          statusFilter || q ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/lot-fulfilment">Clear filters</Link>
            </Button>
          ) : undefined
        }
      />
    ) : rows.length === 0 ? (
      <CatalogListEmptyState
        title="No rows on this page"
        description="Try the previous page or clear filters — results may have shifted."
        action={
          <Button variant="secondary" asChild>
            <Link
              href={buildListHref("/admin/lot-fulfilment", sp, {
                offset: Math.max(0, offset - limit),
              })}
            >
              Previous page
            </Link>
          </Button>
        }
      />
    ) : null;

  const view =
    rows.length > 0 ? <AdminLotFulfilmentBoard rows={rows} returnStatus={returnStatus} /> : null;

  return (
    <CatalogListShell
      title="Lot fulfilment"
      description="After payment is captured, approve release, then ship or mark ready for collection."
      meta={<CatalogRelatedWork variant="fulfilment" navCounts={navCounts} />}
      breadcrumbs={<CatalogOpsBreadcrumb current="Lot fulfilment" />}
      filterBar={filterBar}
      errorAlert={
        <>
          {searchHint}
          {errorAlert}
        </>
      }
      kpiStrip={
        total > 0 ? (
          <AdminListKpiStrip
            ariaLabel="Fulfilment summary"
            tiles={[
              { label: "In queue", value: total },
              {
                label: "Awaiting pickup / release",
                value: awaitingPickup,
                semanticTone: "warning",
              },
              { label: "In transit / released", value: inTransit },
            ]}
          />
        ) : null
      }
      mobileSummary={
        total > 0 ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "queue", label: "In queue", value: String(total) },
              { id: "page", label: "On page", value: String(rows.length) },
            ]}
          />
        ) : null
      }
      empty={empty}
      pagination={pagination}
    >
      {view}
    </CatalogListShell>
  );
}
