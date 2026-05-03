import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { getServerDataContainer } from "@/lib/data/container.server";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

function artistDisplayName(artistId: string): string {
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

  return (
    <div className="screen w-full space-y-6">
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
        <Alert variant="destructive">
          <AlertTitle>Could not load followed artists</AlertTitle>
          <AlertDescription>{err}</AlertDescription>
        </Alert>
      ) : null}

      {!err && rows.length === 0 ? (
        <EmptyState
          title="No followed artists yet"
          description="Follow artists from their public profile to see them listed here."
        />
      ) : null}

      {!err && rows.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <li key={row.watchlistId}>
              <Link
                href={`/artist/${row.artistId}`}
                title={artistDisplayName(row.artistId)}
                className="flex min-h-11 items-center justify-between gap-3 rounded-sm border border-outline-variant/15 bg-surface-container-low/30 px-4 py-3 text-on-surface transition-colors hover:bg-surface-container-high/50"
              >
                <span className="min-w-0 flex-1 truncate font-headline text-sm">
                  {artistDisplayName(row.artistId)}
                </span>
                <span className="shrink-0 font-label text-[10px] uppercase text-primary">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
