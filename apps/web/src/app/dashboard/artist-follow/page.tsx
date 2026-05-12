import { ArtistFollowCard } from "@/components/dashboard/artist-follow-card";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { resolveArtistNames } from "@/lib/data/artist-names.server";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
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
  let err: string | null = null;
  try {
    rows = await c.artistFollow.listMine();
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load followed artists.";
  }

  const artistNameById = await resolveArtistNames(rows.map((r) => r.artistId));

  return (
    <DashboardPage>
      <PageHeader
        title="Followed artists"
        description="Jump to artist profiles you watch for new catalog drops."
        className="border-0 pb-0"
      />

      <DashboardSectionTabs
        ariaLabel="Watchlist sections"
        className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3"
        items={[
          { href: "/dashboard/watchlist", label: "Lots" },
          { href: "/dashboard/artist-follow", label: "Artists", isActive: true },
        ]}
      />

      {err ? (
        <Alert variant="destructive" className="rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not load followed artists</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {!err && rows.length === 0 ? (
        <EmptyState
          title="No followed artists yet"
          description="Follow artists from their public profile to see them listed here."
          action={
            <Button variant="outline" asChild>
              <Link href="/search">Browse catalogue</Link>
            </Button>
          }
        />
      ) : null}

      {!err && rows.length > 0 ? (
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
      ) : null}
    </DashboardPage>
  );
}
