import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminLotsBoard } from "@/components/admin/admin-lots-board";
import type { AdminLotTableRow } from "@/components/admin/admin-lots-board";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
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
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminLotsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { getLotWithdrawalRequests } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui";
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
  const error = safeDecodeAdminErrorParam(sp.error);
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
      : lotsListController.fetch({ ...query, limit: query.limit + 1 }),
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
  const hasNextPage = !attentionLens && !query.viewPipeline && lotRows.length > query.limit;
  const pageRows = hasNextPage ? lotRows.slice(0, query.limit) : lotRows;

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

  const lotTableRows: AdminLotTableRow[] = pageRows.map((a) => ({
    id: a.id,
    title: a.title,
    auctionType: a.auctionType,
    status: a.status,
    endTimeIso: a.endTime.toISOString(),
    endTimeLabel: formatDateTime(a.endTime),
    currentPrice: a.currentPrice,
    ...(a.lifecycleSummary
      ? {
          lastActivityType: a.lifecycleSummary.lastEventType,
          lastActivityAt: a.lifecycleSummary.lastEventAt,
          lastActivityLabel: domainEventLabel(a.lifecycleSummary.lastEventType),
        }
      : {}),
  }));

  const activeOnPage = lotTableRows.filter((r) => r.status === "active").length;
  const draftOnPage = lotTableRows.filter((r) => r.status === "draft").length;

  const lenses =
    nav.withdrawalsPending > 0
      ? lotLensItems(sp, { attention: nav.withdrawalsPending })
      : lotLensItems(sp);

  const pagination =
    !listError && !viewPipeline && !attentionLens && (query.offset > 0 || hasNextPage) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={pageRows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/lots", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          hasNextPage
            ? buildListHref("/admin/lots", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  const empty =
    !listError && !viewPipeline && lotRows.length === 0 ? (
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
        <CatalogListMobileSummary
          segments={[
            lotsTrend.currentTotal > 0 ? `${lotsTrend.currentTotal} new (${periodDays}d)` : null,
            `${lotTableRows.length} on page`,
            activeOnPage > 0 ? `${activeOnPage} live` : null,
            draftOnPage > 0 ? `${draftOnPage} draft` : null,
            attentionLens && nav.withdrawalsPending > 0
              ? `${nav.withdrawalsPending} need attention`
              : null,
          ]}
        />
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
                trendTone: "secondary",
              }),
            ]}
          />
        ) : null
      }
      toolbarEnd={
        <>
          <Link
            href="/sales"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary underline-offset-4 hover:underline"
          >
            Public catalog
          </Link>
          <AdminListExportLink />
        </>
      }
      errorAlert={
        error || listError ? (
          <AdminListAlert title="Could not load lots">{listError ?? error}</AdminListAlert>
        ) : null
      }
      empty={empty}
      pagination={pagination}
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
      {!listError && (viewPipeline || lotTableRows.length > 0) ? (
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
    </CatalogListShell>
  );
}
