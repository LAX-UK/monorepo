import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-data-table";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { LotStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

const statuses: (LotStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
];

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; view?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === "all" || !sp.status ? undefined : (sp.status as LotStatus);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const viewPipeline = sp.view === "pipeline";
  const q = (sp.q ?? "").trim().slice(0, 200);

  let rows: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let listError: string | null = null;
  try {
    rows = await getAdminLotList({
      limit: viewPipeline ? 200 : 100,
      offset: 0,
      ...(viewPipeline || !statusFilter ? {} : { status: statusFilter }),
      ...(q ? { search: q } : {}),
    });
  } catch (e) {
    listError = e instanceof Error ? e.message : "Could not load auctions.";
  }

  const lotTableRows: AdminLotTableRow[] = rows.map((a) => ({
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeLabel: a.endTime.toISOString().slice(0, 16).replace("T", " "),
    currentPrice: a.currentPrice,
  }));

  const statusChips = (
    <fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Filter by status</legend>
      {statuses.map((s) => {
        const qs = new URLSearchParams();
        if (s !== "all") qs.set("status", s);
        if (viewPipeline) qs.set("view", "pipeline");
        if (q) qs.set("q", q);
        const href = qs.toString() ? `/admin/lots?${qs.toString()}` : "/admin/lots";
        const active = (s === "all" && !sp.status) || sp.status === s;
        return (
          <Link
            key={s}
            href={href}
            className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
              active
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </fieldset>
  );

  const layoutToggle = (
    <fieldset className="flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Layout</legend>
      <Link
        href={q ? `/admin/lots?q=${encodeURIComponent(q)}` : "/admin/lots"}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
          !viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Table
      </Link>
      <Link
        href={(() => {
          const qs = new URLSearchParams();
          qs.set("view", "pipeline");
          if (q) qs.set("q", q);
          return `/admin/lots?${qs.toString()}`;
        })()}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
          viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Pipeline
      </Link>
    </fieldset>
  );

  return (
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <PageHeader
        title="Auctions"
        description="Publish, schedule, and triage catalog lots. Use bulk actions after selecting rows (desktop and mobile)."
        actions={
          <Link
            href="/admin/lots/new"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 font-label text-xs font-semibold uppercase tracking-widest text-on-primary shadow-sm hover:opacity-95"
          >
            New lot
          </Link>
        }
      />

      {error || listError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load auctions</AlertTitle>
          <AlertDescription>{listError ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!listError && !viewPipeline && rows.length === 0 ? (
        <p className="text-on-surface-variant">No auctions match this filter.</p>
      ) : (
        <AdminLotsBoard
          rows={lotTableRows}
          fullLots={rows}
          viewPipeline={viewPipeline}
          listError={listError}
          urlError={error}
          statusChips={statusChips}
          layoutToggle={layoutToggle}
        />
      )}
    </div>
  );
}
