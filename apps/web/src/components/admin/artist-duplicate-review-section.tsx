import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import {
  getAdminArtistDuplicateCandidates,
  getAdminArtistList,
} from "@/lib/data/http/admin.server";
import type { AdminArtistListRow } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

const FETCH_CHUNK = 12;
const MAX_ARTISTS_SCAN = 140;
const DISPLAY_MAX = 32;

async function dupesHitsFor(
  rows: readonly AdminArtistListRow[],
): Promise<Array<{ artist: AdminArtistListRow; dupes: AdminArtistDuplicateHit[] }>> {
  const out: Array<{ artist: AdminArtistListRow; dupes: AdminArtistDuplicateHit[] }> = [];
  const slice = rows.slice(0, MAX_ARTISTS_SCAN);
  for (let i = 0; i < slice.length; i += FETCH_CHUNK) {
    const chunk = slice.slice(i, i + FETCH_CHUNK);
    const batch = await Promise.all(
      chunk.map(async (artist) => {
        const dupes = await getAdminArtistDuplicateCandidates(artist.id).catch(() => []);
        return { artist, dupes };
      }),
    );
    for (const b of batch) {
      if (b.dupes.length > 0) out.push(b);
    }
  }
  return out;
}

/**
 * Aggregate duplicate candidates across registry rows — shown from /admin/artists?duplicates=1 .
 * There is no global duplicates API yet; pending artists are scanned first, then a popular-approved slice as fallback.
 */
export async function ArtistDuplicateReviewSection() {
  let loadError: string | null = null;
  let hits: Array<{ artist: AdminArtistListRow; dupes: AdminArtistDuplicateHit[] }> = [];

  try {
    const pending = await getAdminArtistList({ status: "pending", limit: 125, offset: 0 });
    const eligible = pending.rows.filter((r) => r.status !== "merged_into");
    hits = await dupesHitsFor(eligible);

    if (hits.length === 0) {
      const approved = await getAdminArtistList({
        status: "approved",
        sort: "popular",
        limit: 100,
        offset: 0,
      });
      const eligA = approved.rows.filter((r) => r.status !== "merged_into");
      hits = await dupesHitsFor(eligA);
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load duplicate suggestions.";
  }

  if (loadError) {
    return <p className="font-body text-sm text-destructive">{loadError}</p>;
  }

  if (hits.length === 0) {
    return (
      <AdminEmptyState
        title="No duplicate clusters found"
        description="Scanned pending artists (then a sample of catalogue profiles). When the registry suggests overlaps, merge work happens here inline."
      />
    );
  }

  const slice = hits.slice(0, DISPLAY_MAX);

  return (
    <div className="space-y-6">
      <p className="font-body text-sm text-on-surface-variant">
        Server-suggested name overlaps per profile. Pick a survivor in each merge panel, or open an
        artist detail for full context. Showing{" "}
        <span className="tabular-nums font-medium text-on-surface">{slice.length}</span> profile
        {slice.length === 1 ? "" : "s"} (cap {DISPLAY_MAX}).
      </p>
      <ul className="space-y-6">
        {slice.map(({ artist, dupes }) => (
          <li key={artist.id}>
            <Surface variant="section" padding="md" className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-on-surface">
                    <Link
                      href={`/admin/artists/${artist.id}`}
                      className="text-link hover:underline"
                    >
                      {artist.displayName}
                    </Link>
                  </h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 font-body text-xs text-on-surface-variant">
                    Candidate lots: <span className="tabular-nums">{artist.lotCount}</span>
                    {artist.status ? (
                      <AdminStatusBadge domain="artist" status={artist.status} />
                    ) : null}
                  </p>
                </div>
              </div>
              <AdminArtistDuplicatesTable rows={dupes} />
              <AdminArtistMergePanel
                fromArtistId={artist.id}
                fromDisplayName={artist.displayName}
              />
            </Surface>
          </li>
        ))}
      </ul>
      {hits.length > DISPLAY_MAX ? (
        <p className="text-center font-body text-xs text-on-surface-variant">
          {hits.length - DISPLAY_MAX} more profile(s) matched — tighten filters from each artist
          detail page if needed.
        </p>
      ) : null}
    </div>
  );
}
