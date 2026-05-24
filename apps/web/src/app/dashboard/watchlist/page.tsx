import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState, DashboardSkeleton } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { WatchlistBoard } from "@/components/dashboard/watchlist-board";
import { type WatchlistBoardRow, estimateLabel } from "@/components/dashboard/watchlist-board-rows";
import { WatchlistFilterToolbar } from "@/components/dashboard/watchlist-filter-toolbar";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import type { WatchlistWithLotRow } from "@/lib/data/dto/dashboard-dtos";
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

type SortOption = "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
type StatusFilter = "active" | "scheduled" | "ended";

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "addedDesc", label: "Recently added" },
  { value: "endingSoon", label: "Ending soon" },
  { value: "priceAsc", label: "Price low to high" },
  { value: "priceDesc", label: "Price high to low" },
];

function parseParams(raw: { sort?: string; status?: string; categoryIds?: string }): {
  sort: SortOption;
  status?: StatusFilter;
  categoryIds: string[];
} {
  const sort = sortOptions.some((option) => option.value === raw.sort)
    ? (raw.sort as SortOption)
    : "addedDesc";
  const status: StatusFilter | undefined =
    raw.status === "active" || raw.status === "scheduled" || raw.status === "ended"
      ? raw.status
      : undefined;
  const categoryIds = raw.categoryIds
    ? raw.categoryIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  return { sort, ...(status ? { status } : {}), categoryIds };
}

export default async function DashboardWatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; status?: string; categoryIds?: string }>;
}) {
  const filters = parseParams(await searchParams);
  const c = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let categories: Category[] = [];
  let loadFailure: DashboardSliceFailure | null = null;
  let categoriesFailure: DashboardSliceFailure | null = null;

  try {
    rows = await c.watchlist.listMine(filters);
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
  const hasActiveFilters = Boolean(filters.status || filters.categoryIds.length > 0);
  const artistIds = rows.map((r) => r.lot?.artistId ?? null);
  const artistNameById = await resolveArtistNames(artistIds);

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Buying"
        title="Watchlist"
        description="Track lots and artists you are following from the saleroom."
      />

      <Surface variant="inset" padding="sm">
        <SectionTabsNav
          variant="underline"
          ariaLabel="Watchlist sections"
          items={[
            { href: "/dashboard/watchlist", label: "Lots", isActive: true },
            { href: "/dashboard/artist-follow", label: "Artists" },
          ]}
        />
      </Surface>

      {!loadFailure ? <WatchlistFilterToolbar filters={filters} categories={categories} /> : null}

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      {categoriesFailure ? <DashboardSliceErrorAlert failure={categoriesFailure} /> : null}

      {!loadFailure && tableRows.length === 0 ? (
        <DashboardEmptyState
          variant="hero"
          icon={<Heart aria-hidden />}
          title={hasActiveFilters ? "No lots match your filters" : DASHBOARD_EMPTY.watchlist.title}
          description={
            hasActiveFilters
              ? "Try clearing status or category filters to see more saved lots."
              : DASHBOARD_EMPTY.watchlist.description
          }
          action={
            hasActiveFilters ? (
              <Button variant="default" asChild>
                <Link href="/dashboard/watchlist">Clear filters</Link>
              </Button>
            ) : (
              <Button variant="default" asChild>
                <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
              </Button>
            )
          }
        />
      ) : null}

      {!loadFailure && tableRows.length > 0 ? (
        <Suspense fallback={<DashboardSkeleton variant="list" />}>
          <WatchlistBoard rows={tableRows} artistNameById={artistNameById} />
        </Suspense>
      ) : null}
    </DashboardPage>
  );
}
