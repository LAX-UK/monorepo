import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminSalesBoard } from "@/components/admin/admin-sales-board";
import { AdminSavedViewChips } from "@/components/admin/admin-saved-view-chips";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { Button } from "@/components/ui/button";
import { salesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { saleListActivePreset, saleListPresetHref } from "@/lib/admin/list-presets/sales-presets";
import { toAdminSaleBoardRow } from "@/lib/data/view-models/admin-sales.vm";
import type { SaleStatus } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const statuses: (SaleStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
];

const saleStatusChipLabel: Record<SaleStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    error?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = salesListController.parseQuery(sp);
  const q = query.q;
  const statusFilter = query.status;

  let err: string | null = null;
  let rows = [] as Awaited<ReturnType<typeof salesListController.fetch>>["rows"];
  try {
    const result = await salesListController.fetch(query);
    rows = result.rows;
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const boardRows = rows.map(toAdminSaleBoardRow);
  const liveOnPage = boardRows.filter((r) => r.status === "active").length;
  const draftOnPage = boardRows.filter((r) => r.status === "draft").length;

  const savedViews = (
    <AdminSavedViewChips
      activeId={saleListActivePreset(sp)}
      views={[
        { id: "all", label: "All", href: saleListPresetHref("all", sp) },
        { id: "live", label: "Live", href: saleListPresetHref("live", sp) },
        { id: "draft", label: "Draft", href: saleListPresetHref("draft", sp) },
        { id: "ended", label: "Ended", href: saleListPresetHref("ended", sp) },
      ]}
    />
  );

  const statusChips = (
    <FilterChipRow
      label="Filter by status"
      chips={statuses.map((s) => {
        const href = buildListHref("/admin/sales", sp, {
          status: s === "all" ? "" : s,
          q: q ?? "",
          offset: 0,
        });
        return {
          id: s,
          label: saleStatusChipLabel[s],
          href,
          active: (s === "all" && !sp.status) || sp.status === s,
        };
      })}
    />
  );

  const pagination =
    !err && (query.offset > 0 || rows.length === query.limit) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/sales", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          rows.length === query.limit
            ? buildListHref("/admin/sales", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  const hasListFilters = Boolean(statusFilter || q);

  const empty =
    !err && rows.length === 0 ? (
      <EmptyState
        title={hasListFilters ? "No matching sales" : "No sales yet"}
        description={
          hasListFilters
            ? "Try another search keyword or clear the status filter."
            : "Create a sale to group lots for a session or season."
        }
        action={
          hasListFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/sales">Clear filters</Link>
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <Link href="/admin/sales/new">
                <Plus className="size-4" aria-hidden />
                New sale
              </Link>
            </Button>
          )
        }
      />
    ) : null;

  return (
    <AdminListPage
      title="Sales"
      description="Umbrella sessions grouping catalogued lots. Create drafts, attach standalone lots, publish, or cancel from each sale page."
      primaryAction={
        <Button variant="primary" asChild>
          <Link href="/admin/sales/new">
            <Plus className="size-4" aria-hidden />
            New sale
          </Link>
        </Button>
      }
      hasFilters={Boolean(statusFilter || q)}
      resetHref="/admin/sales"
      errorAlert={
        err || error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load sales</AlertTitle>
            <AlertDescription>{err ?? error}</AlertDescription>
          </Alert>
        ) : null
      }
      chips={
        <div className="space-y-3">
          {savedViews}
          {statusChips}
        </div>
      }
      listToolbarEnd={<AdminListExportLink />}
      filters={
        <form
          action="/admin/sales"
          method="get"
          className="flex max-w-xl flex-wrap items-end gap-2"
        >
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1 block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Search titles
            </span>
            <input
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Search by sale title…"
              className="h-11 w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 font-body text-sm text-on-surface"
            />
          </label>
          {statusFilter ? <input type="hidden" name="status" value={sp.status} /> : null}
          <Button variant="secondary" type="submit" className="h-11 shrink-0">
            Search
          </Button>
        </form>
      }
      toolbarEnd={
        <Link
          href="/sales"
          className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary underline-offset-4 hover:underline"
        >
          Public sales
        </Link>
      }
      view={
        !err && boardRows.length > 0 ? (
          <Suspense fallback={<PageSkeleton variant="table" />}>
            <AdminListKpiStrip
              ariaLabel="Sales summary"
              tiles={[
                { label: "On this page", value: boardRows.length },
                { label: "Live", value: liveOnPage },
                { label: "Draft", value: draftOnPage },
              ]}
            />
            <AdminSalesBoard rows={boardRows} toolbarEnd={null} />
          </Suspense>
        ) : null
      }
      empty={empty}
      pagination={pagination}
    />
  );
}
