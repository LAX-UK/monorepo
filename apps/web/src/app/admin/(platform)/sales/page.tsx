import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminSalesBoard } from "@/components/admin/admin-sales-board";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogSalesFilterToolbar } from "@/components/admin/catalog/catalog-sales-filter-toolbar";
import { Button } from "@/components/ui/button";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { salesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import type { SalePresetId } from "@/lib/admin/list-presets/sales-presets";
import { saleListActivePreset, saleListPresetHref } from "@/lib/admin/list-presets/sales-presets";
import { getAdminSalesKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { toAdminSaleBoardRow } from "@/lib/data/view-models/admin-sales.vm";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const PRESET_IDS: SalePresetId[] = ["all", "upcoming", "live", "closed", "settled"];
const PRESET_LABELS: Record<SalePresetId, string> = {
  all: "All",
  upcoming: "Upcoming",
  live: "Live",
  closed: "Closed",
  settled: "Settled",
};

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    lifecycle?: string;
    q?: string;
    error?: string;
    limit?: string;
    offset?: string;
    period?: string;
  }>;
}) {
  const sp = await searchParams;
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = salesListController.parseQuery(sp);
  const q = query.q;
  const statusFilter = query.status;
  const lifecycleSlug = query.lifecycle ?? null;

  const salesTrend = await getAdminSalesKpiTrend(periodDays).catch(() => ({
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: [] as number[],
  }));

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

  const lenses: CatalogSegmentItem[] = PRESET_IDS.map((id) => ({
    id,
    label: PRESET_LABELS[id],
    href: saleListPresetHref(id, sp),
  }));

  const activeLensId = saleListActivePreset(sp);
  const activeFilterCount = [q ?? ""].filter((s) => String(s).trim() !== "").length;

  const pagination =
    !err && (query.offset > 0 || rows.length === query.limit) ? (
      <CatalogPagination
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

  const hasListFilters = Boolean(statusFilter || q || lifecycleSlug != null);

  const empty =
    !err && rows.length === 0 ? (
      <AdminEmptyState
        title={hasListFilters ? "No matching sales" : "No sales yet"}
        description={
          hasListFilters
            ? "Try another search keyword or clear the lifecycle lens."
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
    <CatalogListShell
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
      filterBar={
        <CatalogSalesFilterToolbar
          lenses={lenses}
          activeLensId={activeLensId}
          activeFilterCount={activeFilterCount}
        />
      }
      mobileSummary={
        <p className="font-body text-sm text-on-surface-variant">
          {boardRows.length} on page
          {liveOnPage > 0 ? ` · ${liveOnPage} live` : ""}
          {draftOnPage > 0 ? ` · ${draftOnPage} draft` : ""}
        </p>
      }
      toolbarEnd={
        <>
          <Link
            href="/sales"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary underline-offset-4 hover:underline"
          >
            Public sales
          </Link>
          <AdminListExportLink />
        </>
      }
      kpiStrip={
        boardRows.length > 0 ? (
          <AdminTrendKpiBand
            ariaLabel="Sales summary"
            tiles={[
              buildTrendKpiTile("New sales", salesTrend, periodDays, { emphasize: true }),
              {
                label: "On this page",
                value: String(boardRows.length),
                compareHint: `Live ${liveOnPage} · draft ${draftOnPage}`,
              },
              buildTrendKpiTile("Scheduled activity", salesTrend, periodDays, {
                trendTone: "secondary",
              }),
            ]}
          />
        ) : null
      }
      errorAlert={
        err || error ? (
          <AdminListAlert title="Could not load sales">{err ?? error}</AdminListAlert>
        ) : null
      }
    >
      {!err && boardRows.length > 0 ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminSalesBoard rows={boardRows} toolbarEnd={null} />
        </Suspense>
      ) : null}
      {!err && rows.length === 0 ? empty : null}
      {pagination}
    </CatalogListShell>
  );
}
