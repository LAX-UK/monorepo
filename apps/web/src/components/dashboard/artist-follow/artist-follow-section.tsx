import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ArtistFollowList } from "@/components/dashboard/artist-follow/artist-follow-list";
import { ArtistFollowListToolbar } from "@/components/dashboard/artist-follow/artist-follow-list-toolbar";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import {
  filterArtistFollowRows,
  parseArtistFollowParams,
  sortArtistFollowRows,
} from "@/lib/dashboard/filters/artist-follow/artist-follow-filters";
import { resolveArtistFollowProfiles } from "@/lib/data/artist-follow-profiles.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Button } from "@auction/ui/components/button";
import { Heart } from "lucide-react";
import Link from "next/link";

export async function ArtistFollowSection({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const filters = parseArtistFollowParams(await searchParams);
  const c = await getServerDataContainer();
  let rows: Awaited<ReturnType<typeof c.artistFollow.listMine>> = [];
  let loadFailure: DashboardSliceFailure | null = null;
  try {
    rows = await c.artistFollow.listMine();
  } catch (e) {
    loadFailure = describeDashboardSliceFailure(
      e,
      "artistFollow",
      "Could not load followed artists.",
    );
  }

  const cardRows = loadFailure ? [] : await resolveArtistFollowProfiles(rows);
  const sorted = sortArtistFollowRows(
    cardRows.map((row) => ({
      watchlistId: row.watchlistId,
      artistId: row.artistId,
      displayName: row.displayName,
      createdAtMs: row.followedAtMs,
    })),
    filters.sort,
  );
  const orderedCards = sorted
    .map((row) => cardRows.find((card) => card.watchlistId === row.watchlistId))
    .filter((card): card is NonNullable<typeof card> => card != null);
  const filtered = filterArtistFollowRows(
    orderedCards.map((row) => ({
      watchlistId: row.watchlistId,
      artistId: row.artistId,
      displayName: row.displayName,
      createdAtMs: row.followedAtMs,
    })),
    filters.q,
  );
  const filteredCards = filtered
    .map((row) => orderedCards.find((card) => card.watchlistId === row.watchlistId))
    .filter((card): card is NonNullable<typeof card> => card != null);

  return (
    <>
      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}
      {!loadFailure ? <ArtistFollowListToolbar filters={filters} /> : null}
      {!loadFailure ? (
        <DashboardFilterResultsAnnouncer count={filteredCards.length} entityLabel="artists" />
      ) : null}
      {!loadFailure && rows.length === 0 ? (
        <DashboardEmptyState
          variant="hero"
          icon={<Heart aria-hidden />}
          title={DASHBOARD_EMPTY.artistFollow.title}
          description={DASHBOARD_EMPTY.artistFollow.description}
          action={
            <Button variant="outline" asChild>
              <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
            </Button>
          }
        />
      ) : null}
      {!loadFailure && rows.length > 0 && filteredCards.length === 0 ? (
        <FilterEmptyState
          segment="dashboard"
          entity="artists"
          clearFiltersHref="/dashboard/watchlist?section=artists"
        />
      ) : null}
      {!loadFailure && filteredCards.length > 0 ? (
        <ArtistFollowList artists={filteredCards} />
      ) : null}
    </>
  );
}
