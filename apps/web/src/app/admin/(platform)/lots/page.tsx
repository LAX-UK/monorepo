import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-board";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogLotsFilterToolbar } from "@/components/admin/catalog/catalog-lots-filter-toolbar";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { LotFilterOptionsLoader } from "@/components/admin/lot-filter-options-loader";
import { AdminWithdrawalsBoard } from "@/components/admin/withdrawals-board";
import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { lotsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildTrendKpiTile } from "@/lib/admin/build-trend-kpi-tile";
import { lotActiveLensId, lotLensItems } from "@/lib/admin/catalog/lots-lenses";
import { getAdminLotsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { getLotWithdrawalRequests } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

type LotSort = "createdDesc" | "endingAsc" | "hammerDesc" | "endedDesc" | "sellerAsc";
const VALID_SORTS: LotSort[] = ["createdDesc", "endingAsc", "hammerDesc", "endedDesc", "sellerAsc"];

export default async function AdminLotsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    view?: string;
    q?: string;
    artistId?: string;
    saleId?: string;
    categoryId?: string;
    sort?: string;
    limit?: string;
    offset?: string;
    period?: string;
    lens?: string;
  }>;
}) {
  const sp = await searchParams;
  const activeLens = lotActiveLensId(sp);
  const attentionLens = activeLens === "attention";
  const periodDays = parseAdminKpiPeriod(sp.period);
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const sort = VALID_SORTS.includes(sp.sort as LotSort) ? (sp.sort as LotSort) : undefined;

  const query = lotsListController.parseQuery({
    ...sp,
    ...(sort ? { sort } : {}),
    ...(activeLens === "live" ? { status: "active" } : {}),
    ...(activeLens === "draft" ? { status: "draft" } : {}),
    ...(activeLens === "ending" ? { status: "active", sort: "endingAsc" } : {}),
    ...(attentionLens ? { status: "draft" } : {}),
  });

  const [lotResult, lotsTrendResult, withdrawalResult, navCounts] = await Promise.allSettled([
    attentionLens
      ? lotsListController.fetch({ ...query, status: "draft", limit: 200 })
      : lotsListController.fetch(query),
    getAdminLotsKpiTrend(periodDays),
    attentionLens ? getLotWithdrawalRequests() : Promise.resolve([]),
    getAdminNavCounts(),
  ]);

  const lotsTrend =
    lotsTrendResult.status === "fulfilled"
      ? lotsTrendResult.value
      : { currentTotal: 0, priorTotal: 0, dailyCounts: [] as number[] };

  let lotRows = lotResult.status === "fulfilled" ? lotResult.value.rows : [];
  if (attentionLens) {
    lotRows = lotRows.filter((l) => l.images.length === 0);
  }

  const withdrawalTasks = withdrawalResult.status === "fulfilled" ? withdrawalResult.value : [];
  const withdrawalLoadError =
    withdrawalResult.status === "rejected"
      ? withdrawalResult.reason instanceof Error
        ? withdrawalResult.reason.message
        : "Could not load withdrawal requests."
      : null;

  const nav =
    navCounts.status === "fulfilled"
      ? navCounts.value
      : { withdrawalsPending: 0, submissionsPending: 0, artistsPending: 0 };

  const listError =
    lotResult.status === "rejected"
      ? lotResult.reason instanceof Error
        ? lotResult.reason.message
        : "Could not load lots."
      : null;

  const viewPipeline = query.viewPipeline ?? false;
  const q = query.q ?? "";
  const artistId = query.artistId ?? "";
  const saleId = query.saleId ?? "";
  const categoryId = query.categoryId ?? "";

  const advancedFilterCount = [q, artistId, saleId, categoryId, sort, viewPipeline].filter(
    Boolean,
  ).length;

  const lotTableRows: AdminLotTableRow[] = lotRows.map((a) => ({
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeIso: a.endTime.toISOString(),
    endTimeLabel: formatDateTime(a.endTime),
    currentPrice: a.currentPrice,
  }));

  const activeOnPage = lotTableRows.filter((r) => r.status === "active").length;
  const draftOnPage = lotTableRows.filter((r) => r.status === "draft").length;

  const lenses =
    nav.withdrawalsPending > 0
      ? lotLensItems(sp, { attention: nav.withdrawalsPending })
      : lotLensItems(sp);

  const pagination =
    !listError && !viewPipeline && (query.offset > 0 || lotRows.length === query.limit) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={lotRows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/lots", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          lotRows.length === query.limit
            ? buildListHref("/admin/lots", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <CatalogListShell
      title="Lots"
      description="Publish, schedule, and triage catalogue lots."
      primaryAction={
        <Button variant="default" asChild>
          <Link href="/admin/lots/new">
            <Plus className="size-4" aria-hidden />
            New lot
          </Link>
        </Button>
      }
      filterBar={
        <CatalogLotsFilterToolbar
          lenses={lenses}
          activeLensId={activeLens}
          activeFilterCount={advancedFilterCount}
          sheetFilters={
            <Suspense fallback={<PageSkeleton variant="table" />}>
              <LotFilterOptionsLoader
                {...(typeof sp.status === "string" && sp.status.trim() !== ""
                  ? { status: sp.status }
                  : {})}
                {...(q.trim() !== "" ? { q } : {})}
                {...(viewPipeline ? { viewPipeline: true } : {})}
                {...(artistId.trim() !== "" ? { artistId } : {})}
                {...(saleId.trim() !== "" ? { saleId } : {})}
                {...(categoryId.trim() !== "" ? { categoryId } : {})}
                {...(sort !== undefined ? { sort } : {})}
                lens={activeLens}
              />
            </Suspense>
          }
        />
      }
      mobileSummary={
        <p className="font-body text-sm text-on-surface-variant">
          {lotTableRows.length} on page
          {activeOnPage > 0 ? ` · ${activeOnPage} live` : ""}
          {draftOnPage > 0 ? ` · ${draftOnPage} draft` : ""}
        </p>
      }
      kpiStrip={
        !viewPipeline && lotTableRows.length > 0 ? (
          <AdminTrendKpiBand
            ariaLabel="Lots summary"
            tiles={[
              buildTrendKpiTile("New lots", lotsTrend, periodDays, { emphasize: true }),
              {
                label: "On this page",
                value: String(lotTableRows.length),
                compareHint: `Live ${activeOnPage} · draft ${draftOnPage}`,
              },
              buildTrendKpiTile("Catalog activity", lotsTrend, periodDays, {
                trendTone: "lot-orange",
              }),
            ]}
          />
        ) : null
      }
      toolbarEnd={<AdminListExportLink />}
      errorAlert={
        error || listError ? (
          <AdminListAlert title="Could not load lots">{listError ?? error}</AdminListAlert>
        ) : null
      }
    >
      {attentionLens && withdrawalLoadError ? (
        <AdminListAlert title="Could not load withdrawals">{withdrawalLoadError}</AdminListAlert>
      ) : null}
      {attentionLens && !withdrawalLoadError && withdrawalTasks.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Withdrawal requests
          </h2>
          <AdminWithdrawalsBoard tasks={withdrawalTasks} />
        </section>
      ) : null}
      {attentionLens && lotTableRows.length > 0 ? (
        <h2 className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Drafts missing photos
        </h2>
      ) : null}
      {!listError ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminLotsBoard
            rows={lotTableRows}
            fullLots={lotRows}
            viewPipeline={viewPipeline}
            listError={listError}
            urlError={error}
            searchQuery={q}
          />
        </Suspense>
      ) : null}
      {!listError && !viewPipeline && lotRows.length === 0 ? (
        <AdminEmptyState
          title={q || activeLens !== "all" ? "No matching lots" : "No lots yet"}
          description={
            q || activeLens !== "all"
              ? "Try another lens or clear filters in More filters."
              : "Create the first draft lot and assign a seller."
          }
          action={
            !q && activeLens === "all" ? (
              <Button variant="default" asChild>
                <Link href="/admin/lots/new">
                  <Plus className="size-4" aria-hidden />
                  New lot
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" asChild>
                <Link href="/admin/lots">Clear filters</Link>
              </Button>
            )
          }
        />
      ) : null}
      {pagination}
    </CatalogListShell>
  );
}
