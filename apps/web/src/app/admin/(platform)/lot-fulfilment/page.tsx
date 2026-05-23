import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotFulfilmentFilterToolbar } from "@/components/admin/catalog/catalog-lot-fulfilment-filter-toolbar";
import { AdminLotFulfilmentBoard } from "@/components/admin/lot-fulfilment-board";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";
import { Suspense } from "react";

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
  searchParams: Promise<{ error?: string; status?: string; limit?: string; offset?: string }>;
};

export default async function AdminLotFulfilmentQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const statusFilter = parseStatusFilter(typeof sp.status === "string" ? sp.status : undefined);
  const error = safeDecodeAdminErrorParam(sp.error);

  const loaded = await loadAdminLotFulfilmentQueue(
    statusFilter !== undefined ? { status: statusFilter } : {},
  );

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
  const returnStatus = statusFilter ?? "";

  const filterBar = (
    <Suspense
      fallback={
        <div
          className="min-h-[3.25rem] rounded-md border border-border-hairline bg-surface-container-low/40"
          aria-hidden
        />
      }
    >
      <CatalogLotFulfilmentFilterToolbar activeStatus={statusFilter} searchParams={sp} />
    </Suspense>
  );

  const errorAlert = error ? <AdminListAlert title="Action failed">{error}</AdminListAlert> : null;

  const empty =
    rows.length === 0 ? (
      <AdminEmptyState
        title="Nothing in this view"
        description={
          statusFilter
            ? "No lots match this filter. Try “All” or another status."
            : "No fulfilment rows yet."
        }
      />
    ) : null;

  const view =
    rows.length > 0 ? <AdminLotFulfilmentBoard rows={rows} returnStatus={returnStatus} /> : null;

  return (
    <CatalogListShell
      title="Lot fulfilment"
      description="After payment is captured, approve release, then ship or mark ready for collection."
      filterBar={filterBar}
      errorAlert={errorAlert}
      mobileSummary={
        rows.length > 0 ? (
          <CatalogListMobileSummary
            segments={[
              `${rows.length} in queue`,
              statusFilter ? statusFilter.replaceAll("_", " ") : null,
            ]}
          />
        ) : null
      }
      empty={empty}
    >
      {view}
    </CatalogListShell>
  );
}
