import { AdminAuctionPipeline } from "@/components/admin/admin-auction-pipeline";
import {
  type AdminLotTableRow,
  AdminLotsDataTable,
} from "@/components/admin/admin-lots-data-table";
import { DisplayHeading } from "@/components/ui/typography";
import { getAdminLotList } from "@/lib/data/http/admin.server";
import type { LotStatus } from "@auction/types";
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
  searchParams: Promise<{ status?: string; error?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status === "all" || !sp.status ? undefined : (sp.status as LotStatus);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const viewPipeline = sp.view === "pipeline";

  let rows: Awaited<ReturnType<typeof getAdminLotList>> = [];
  let listError: string | null = null;
  try {
    rows = await getAdminLotList({
      limit: viewPipeline ? 200 : 100,
      offset: 0,
      ...(viewPipeline || !statusFilter ? {} : { status: statusFilter }),
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

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <DisplayHeading as="h1" className="text-4xl">
          Auctions
        </DisplayHeading>
        <Link
          href="/admin/lots/new"
          className="inline-flex w-fit items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-[0.3em] text-on-primary shadow-sm hover:opacity-95"
        >
          New auction
        </Link>
      </div>

      {(error || listError) && (
        <div
          className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 font-body text-sm text-error"
          role="alert"
        >
          {listError ?? error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => {
            const qs = new URLSearchParams();
            if (s !== "all") qs.set("status", s);
            if (viewPipeline) qs.set("view", "pipeline");
            const href = qs.toString() ? `/admin/lots?${qs.toString()}` : "/admin/lots";
            const active = (s === "all" && !sp.status) || sp.status === s;
            return (
              <Link
                key={s}
                href={href}
                className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
                  active
                    ? "bg-primary text-on-primary ring-primary"
                    : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
                }`}
              >
                {s}
              </Link>
            );
          })}
        </div>
        <span className="hidden h-6 w-px bg-outline-variant/30 sm:block" aria-hidden />
        <div className="flex gap-2">
          <Link
            href="/admin/lots"
            className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
              !viewPipeline
                ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            Table
          </Link>
          <Link
            href="/admin/lots?view=pipeline"
            className={`rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
              viewPipeline
                ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            Pipeline
          </Link>
        </div>
      </div>

      {viewPipeline ? (
        rows.length === 0 && !listError ? (
          <p className="text-on-surface-variant">No auctions loaded.</p>
        ) : (
          <AdminAuctionPipeline auctions={rows} />
        )
      ) : rows.length === 0 && !listError ? (
        <p className="text-on-surface-variant">No auctions match this filter.</p>
      ) : (
        <AdminLotsDataTable rows={lotTableRows} />
      )}
    </div>
  );
}
