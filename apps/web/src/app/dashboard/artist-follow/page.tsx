import { ArtistFollowCard } from "@/components/dashboard/artist-follow-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import {
  type DashboardSliceFailure,
  describeDashboardSliceFailure,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

function fallbackArtistName(artistId: string): string {
  return artistId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export default async function ArtistFollowPage() {
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

  return (
    <DashboardPage>
      <DashboardPageHeader
        meta="Buying"
        title="Followed artists"
        description="Jump to artist profiles you watch for new catalog drops."
      />

      <SectionTabsNav
        variant="underline"
        ariaLabel="Watchlist sections"
        className="rounded-xl border border-border-hairline bg-surface-container-lowest px-3"
        items={[
          { href: "/dashboard/watchlist", label: "Lots" },
          { href: "/dashboard/artist-follow", label: "Artists", isActive: true },
        ]}
      />

      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      {!loadFailure && rows.length === 0 ? (
        <DashboardEmptyState
          title={DASHBOARD_EMPTY.artistFollow.title}
          description={DASHBOARD_EMPTY.artistFollow.description}
          action={
            <Button variant="outline" asChild>
              <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
            </Button>
          }
        />
      ) : null}

      {!loadFailure && rows.length > 0 ? (
        <DashboardSection id="artist-follow-grid" title="Artists you follow">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => {
              const displayName = artistNameById[row.artistId] ?? fallbackArtistName(row.artistId);
              return (
                <li key={row.watchlistId}>
                  <ArtistFollowCard artistId={row.artistId} displayName={displayName} />
                </li>
              );
            })}
          </ul>
        </DashboardSection>
      ) : null}
    </DashboardPage>
  );
}
