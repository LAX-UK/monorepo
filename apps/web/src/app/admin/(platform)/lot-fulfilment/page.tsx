import { AdminLotFulfilmentQueueCard } from "@/components/admin/admin-lot-fulfilment-queue-card";
import { AppScreen } from "@/components/dashboard/dashboard-page";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

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
  searchParams: Promise<{ error?: string; status?: string }>;
};

export default async function AdminLotFulfilmentQueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const statusFilter = parseStatusFilter(sp.status);
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const loaded = await loadAdminLotFulfilmentQueue(
    statusFilter !== undefined ? { status: statusFilter } : {},
  );

  if (loaded.access === "forbidden") {
    return (
      <AppScreen className="max-w-3xl space-y-6">
        <PageHeader
          title="Lot fulfilment"
          description="Release, shipping, and collection workflow for sold lots."
          className="border-0 pb-0"
        />
        <Alert variant="destructive">
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>
            Your account does not have the operations fulfilment staff role. Ask a super-admin if
            you need access to this queue.
          </AlertDescription>
        </Alert>
      </AppScreen>
    );
  }

  if (loaded.access === "error") {
    return (
      <AppScreen className="max-w-3xl space-y-6">
        <PageHeader
          title="Lot fulfilment"
          description="Release, shipping, and collection workflow for sold lots."
          className="border-0 pb-0"
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load queue</AlertTitle>
          <AlertDescription>{loaded.message}</AlertDescription>
        </Alert>
      </AppScreen>
    );
  }

  const rows = loaded.rows;
  const returnStatus = statusFilter ?? "";

  const chips = (
    <fieldset className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto border-0 p-0 pb-1 sm:flex-wrap sm:overflow-visible">
      <legend className="sr-only">Filter by fulfilment status</legend>
      {(["all", ...FILTER_STATUSES] as const).map((s) => {
        const qs = new URLSearchParams();
        if (s !== "all") qs.set("status", s);
        const href = qs.toString()
          ? `/admin/lot-fulfilment?${qs.toString()}`
          : "/admin/lot-fulfilment";
        const active = (s === "all" && !statusFilter) || sp.status === s;
        return (
          <Link
            key={s}
            href={href}
            className={`shrink-0 snap-start rounded-full px-3 py-2 font-label text-[10px] uppercase tracking-widest ring-1 transition-colors sm:px-4 ${
              active
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            {s === "all" ? "All" : s.replaceAll("_", " ")}
          </Link>
        );
      })}
    </fieldset>
  );

  return (
    <AppScreen className="max-w-3xl space-y-6">
      <PageHeader
        title="Lot fulfilment"
        description="After payment is captured, approve release, then either ship (carrier + tracking) or mark ready for collection. Close out with delivered or collected."
        className="border-0 pb-0"
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {chips}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing in this view"
          description={
            statusFilter
              ? "No lots match this filter. Try “All” or another status."
              : "No fulfilment rows yet. They appear when winners start checkout or after payment is recorded."
          }
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <AdminLotFulfilmentQueueCard key={row.id} row={row} returnStatus={returnStatus} />
          ))}
        </ul>
      )}
    </AppScreen>
  );
}
