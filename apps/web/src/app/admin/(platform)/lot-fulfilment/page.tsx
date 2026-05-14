import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminLotFulfilmentQueueCard } from "@/components/admin/admin-lot-fulfilment-queue-card";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";

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
        className="max-w-3xl"
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={
          <Alert variant="destructive">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              Your account does not have the operations fulfilment staff role. Ask a super-admin if
              you need access to this queue.
            </AlertDescription>
          </Alert>
        }
        view={null}
      />
    );
  }

  if (loaded.access === "error") {
    return (
      <AdminListPage
        className="max-w-3xl"
        title="Lot fulfilment"
        description="Release, shipping, and collection workflow for sold lots."
        errorAlert={
          <Alert variant="destructive">
            <AlertTitle>Could not load queue</AlertTitle>
            <AlertDescription>{loaded.message}</AlertDescription>
          </Alert>
        }
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

  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertTitle>Action failed</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;

  const empty =
    rows.length === 0 ? (
      <EmptyState
        title="Nothing in this view"
        description={
          statusFilter
            ? "No lots match this filter. Try “All” or another status."
            : "No fulfilment rows yet. They appear when winners start checkout or after payment is recorded."
        }
      />
    ) : null;

  const view =
    rows.length > 0 ? (
      <ul className="space-y-4">
        {rows.map((row) => (
          <AdminLotFulfilmentQueueCard key={row.id} row={row} returnStatus={returnStatus} />
        ))}
      </ul>
    ) : null;

  return (
    <AdminListPage
      className="max-w-3xl"
      title="Lot fulfilment"
      description="After payment is captured, approve release, then either ship (carrier + tracking) or mark ready for collection. Close out with delivered or collected."
      errorAlert={errorAlert}
      chips={chips}
      view={view}
      empty={empty}
    />
  );
}
