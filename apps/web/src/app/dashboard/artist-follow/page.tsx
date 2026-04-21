import { BodyText, DisplayHeading, LabelCaps } from "@auction/ui";
import { EmptyState } from "@auction/ui/components/empty-state";
import { getServerDataContainer } from "@/lib/data/container.server";
import Link from "next/link";

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
    <div className="mx-auto w-full max-w-[var(--container-inner,1376px)] space-y-8">
      <header className="space-y-2 border-b border-outline-variant/10 pb-8">
        <LabelCaps className="text-lot-orange">Discovery</LabelCaps>
        <DisplayHeading as="h1" className="text-3xl md:text-4xl">
          Artists you follow
        </DisplayHeading>
        <BodyText className="max-w-xl text-on-surface-variant">
          Jump to artist profiles you watch for new catalog drops.
        </BodyText>
      </header>

      {err ? <p className="text-live-red">{err}</p> : null}

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
                className="flex min-h-11 items-center justify-between rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-4 py-3 font-headline text-sm text-on-surface transition-colors hover:bg-surface-container-high/60"
              >
                <span className="truncate font-mono text-xs">{row.artistId}</span>
                <span className="font-label text-[10px] uppercase text-primary">Open</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
