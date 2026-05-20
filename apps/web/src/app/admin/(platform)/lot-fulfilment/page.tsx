import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { AdminLotFulfilmentBoard } from "@/components/admin/lot-fulfilment-board";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";

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
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const loaded = await loadAdminLotFulfilmentQueue(
    statusFilter !== undefined ? { status: statusFilter } : {},
  );

  if (loaded.access === "forbidden") {
    return (
      <AdminListPage
        className="max-w-5xl"
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={
          <AdminListAlert title="Access denied">
            Your account does not have the operations fulfilment staff role.
          </AdminListAlert>
        }
        view={null}
      />
    );
  }

  if (loaded.access === "error") {
    return (
      <AdminListPage
        className="max-w-5xl"
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={<AdminListAlert title="Could not load queue">{loaded.message}</AdminListAlert>}
        view={null}
      />
    );
  }

  const rows = loaded.rows;
  const returnStatus = statusFilter ?? "";

  const chips = (
    <FilterChipRow
      label="Filter by fulfilment status"
      chips={(["all", ...FILTER_STATUSES] as const).map((s) => ({
        id: s,
        label: s === "all" ? "All" : s.replaceAll("_", " "),
        href: buildListHref("/admin/lot-fulfilment", sp, {
          status: s === "all" ? "" : s,
          offset: 0,
        }),
        active: (s === "all" && !statusFilter) || sp.status === s,
      }))}
    />
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

  return (
    <AdminListPage
      className="max-w-5xl"
      title="Lot fulfilment"
      description="After payment is captured, approve release, then ship or mark ready for collection."
      errorAlert={errorAlert}
      chips={chips}
      view={
        rows.length > 0 ? (
          <AdminLotFulfilmentBoard rows={rows} returnStatus={returnStatus} statusChips={chips} />
        ) : null
      }
      empty={empty}
    />
  );
}
