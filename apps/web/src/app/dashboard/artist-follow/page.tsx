import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { ArtistFollowCard } from "@/components/dashboard/artist-follow-card";
import { ArtistFollowListToolbar } from "@/components/dashboard/artist-follow/artist-follow-list-toolbar";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
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
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { readClientWorkspacePageMeta } from "@/lib/workspace/client-workspace-mode";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import { Heart } from "lucide-react";
import Link from "next/link";

function fallbackArtistName(artistId: string): string {
  return artistId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default async function ArtistFollowPage({
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

  const artistNameById = await resolveArtistNames(rows.map((r) => r.artistId));
  const displayRows = sortArtistFollowRows(
    rows.map((row) => ({
      watchlistId: row.watchlistId,
      artistId: row.artistId,
      displayName: artistNameById[row.artistId] ?? fallbackArtistName(row.artistId),
      createdAtMs: row.createdAt.getTime(),
    })),
    filters.sort,
  );
  const filtered = filterArtistFollowRows(displayRows, filters.q);
  const workspaceMeta = await readClientWorkspacePageMeta();

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta={workspaceMeta}
        title="Followed artists"
        hideTitleOnMobile
        hideDescriptionOnMobile
        description="Jump to artist profiles you watch for new catalog drops."
      />

      <Surface variant="inset" padding="sm">
        <SectionTabsNav
          variant="underline"
          ariaLabel="Watchlist sections"
          sticky={false}
          items={[
            { href: "/dashboard/watchlist", label: "Lots" },
            { href: "/dashboard/artist-follow", label: "Artists", isActive: true },
          ]}
        />
      </Surface>

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      {!loadFailure ? <ArtistFollowListToolbar filters={filters} /> : null}

      {!loadFailure ? (
        <DashboardFilterResultsAnnouncer count={filtered.length} entityLabel="artists" />
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

      {!loadFailure && rows.length > 0 && filtered.length === 0 ? (
        <FilterEmptyState
          segment="dashboard"
          entity="artists"
          clearFiltersHref="/dashboard/artist-follow"
        />
      ) : null}

      {!loadFailure && filtered.length > 0 ? (
        <DashboardSection id="artist-follow-grid" title="Artists you follow">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((row) => (
              <li key={row.watchlistId}>
                <ArtistFollowCard artistId={row.artistId} displayName={row.displayName} />
              </li>
            ))}
          </ul>
        </DashboardSection>
      ) : null}
    </DashboardPage>
  );
}
