import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ArtistFollowSection } from "@/components/dashboard/artist-follow/artist-follow-section";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState, DashboardSkeleton } from "@/components/dashboard/primitives";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { WatchlistBoard } from "@/components/dashboard/watchlist-board";
import { type WatchlistBoardRow, estimateLabel } from "@/components/dashboard/watchlist-board-rows";
import { WatchlistListToolbar } from "@/components/dashboard/watchlist/watchlist-list-toolbar";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  buildWatchlistHref,
  hasWatchlistActiveFilters,
  parseWatchlistParams,
} from "@/lib/dashboard/filters/watchlist/watchlist-filters";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import type { Category } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Heart } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function toWatchlistRows(rows: WatchlistWithLotRow[]): WatchlistBoardRow[] {
  return rows.flatMap((row) => {
    const lot = row.lot;
    if (!lot) return [];

    return [
      {
        watchlistId: row.watchlistId,
        lotId: lot.id,
        title: lot.title,
        artistLabel: lot.artistId ?? "",
        image: lot.images[0] ?? null,
        medium: lot.medium,
        lotNumber: lot.lotNumber,
        estimateLabel: estimateLabel({
          estimate: lot.marketingDetails.estimate,
          fallback: lot.currentPrice,
        }),
        status: lot.status,
        startTime: lot.startTime.toISOString(),
        endTime: lot.endTime.toISOString(),
      },
    ];
  });
}

type PageSearchParams = {
  sort?: string;
  status?: string;
  categoryIds?: string;
  q?: string;
  section?: string;
};

export default async function DashboardWatchlistPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;
  const isArtistsSection = sp.section === "artists";
  const workspaceMeta = await readClientWorkspacePageMeta();

  const tabs = (
    <Surface variant="inset" padding="sm">
      <SectionTabsNav
        variant="underline"
        ariaLabel="Watchlist sections"
        sticky={false}
        items={[
          { href: "/dashboard/watchlist", label: "Lots", isActive: !isArtistsSection },
          {
            href: "/dashboard/watchlist?section=artists",
            label: "Artists",
            isActive: isArtistsSection,
          },
        ]}
      />
    </Surface>
  );

  if (isArtistsSection) {
    return (
      <DashboardListPage
        meta={workspaceMeta}
        title="Watchlist"
        description="Track lots and artists you are following from the saleroom."
        tabs={tabs}
      >
        <Suspense fallback={<DashboardSkeleton variant="list" />}>
          <ArtistFollowSection
            searchParams={Promise.resolve({
              ...(sp.q ? { q: sp.q } : {}),
              ...(sp.sort ? { sort: sp.sort } : {}),
            })}
          />
        </Suspense>
      </DashboardListPage>
    );
  }

  const filters = parseWatchlistParams(sp);
  const c = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let categories: Category[] = [];
  let loadFailure: DashboardSliceFailure | null = null;
  let categoriesFailure: DashboardSliceFailure | null = null;

  try {
    rows = await c.watchlist.listMine({
      sort: filters.sort,
      ...(filters.status ? { status: filters.status } : {}),
      categoryIds: filters.categoryIds,
    });
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(e, "watchlist", "Could not load watchlist.");
  }

  try {
    categories = await c.categories.list();
  } catch (e) {
    categoriesFailure = describeDashboardSliceFailure(
      e,
      "categories",
      "Could not load categories.",
    );
  }

  const tableRows = toWatchlistRows(rows);
  const hasActiveFilters = hasWatchlistActiveFilters(filters);
  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  return (
    <DashboardListPage
      meta={workspaceMeta}
      title="Watchlist"
      description="Track lots and artists you are following from the saleroom."
      tabs={tabs}
      toolbar={
        !loadFailure ? <WatchlistListToolbar filters={filters} categories={categories} /> : null
      }
      errorAlert={
        <>
          {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
          {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}
        </>
      }
    >
      {!loadFailure && tableRows.length === 0 ? (
        hasActiveFilters ? (
          <FilterEmptyState
            segment="dashboard"
            entity="watched lots"
            clearFiltersHref="/dashboard/watchlist"
            browseHref="/search"
            browseLabel={DASHBOARD_CTA.browseLiveAuctions}
          />
        ) : (
          <DashboardEmptyState
            variant="hero"
            icon={<Heart aria-hidden />}
            title={DASHBOARD_EMPTY.watchlist.title}
            description={DASHBOARD_EMPTY.watchlist.description}
            action={
              <Button variant="primary" asChild>
                <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
              </Button>
            }
          />
        )
      ) : null}

      {!loadFailure && tableRows.length > 0 ? (
        <Suspense fallback={<DashboardSkeleton variant="list" />}>
          <WatchlistBoard
            rows={tableRows}
            artistNameById={artistNameById}
            initialQ={filters.q}
            clearSearchHref={buildWatchlistHref(filters, { q: null })}
          />
        </Suspense>
      ) : null}
    </DashboardListPage>
  );
}
