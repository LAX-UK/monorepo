import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminArtistDuplicateHit } from "@/lib/data/http/admin.server";
import {
  getAdminArtistDuplicateCandidates,
  getAdminArtistList,
} from "@/lib/data/http/admin.server";
import { EmptyState, Notice, Section, StaffButtonLink, StatusBadge } from "@auction/staff-ui";
import type { AdminArtistListRow } from "@auction/types";
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
 * Profiles with similar names, gathered across the registry for the duplicates queue. There is no
 * registry-wide duplicates endpoint yet, so pending profiles are scanned first and, if they have
 * none, a sample of popular approved ones. Each cluster can be merged on the spot.
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
    return (
      <Notice tone="danger" alert title="The duplicate suggestions did not load">
        {loadError}
      </Notice>
    );
  }

  if (hits.length === 0) {
    return (
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <EmptyState
          title="No duplicates found"
          description="Pending profiles and a sample of catalogue profiles were checked. When the registry suggests overlaps, you can merge them here."
        />
      </div>
    );
  }

  const slice = hits.slice(0, DISPLAY_MAX);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-staff-sm text-staff-muted">
        Showing {slice.length} {slice.length === 1 ? "profile" : "profiles"} with similar names.
        Choose the profile to keep in each, or open a profile to compare.
      </p>
      {slice.map(({ artist, dupes }) => {
        const status = artist.status ? staffStatus("artist", artist.status) : null;
        return (
          <Section
            key={artist.id}
            title={artist.displayName}
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                {artist.lotCount} {artist.lotCount === 1 ? "lot" : "lots"}
                {status ? <StatusBadge tone={status.tone}>{status.label}</StatusBadge> : null}
              </span>
            }
            action={
              <StaffButtonLink
                size="sm"
                variant="ghost"
                href={`/admin/artists/${artist.id}`}
                Link={Link}
              >
                Open profile
              </StaffButtonLink>
            }
            bodyClassName="p-0"
          >
            <AdminArtistDuplicatesTable rows={dupes} />
            <AdminArtistMergePanel
              bare
              fromArtistId={artist.id}
              fromDisplayName={artist.displayName}
            />
          </Section>
        );
      })}
      {hits.length > DISPLAY_MAX ? (
        <p className="text-center text-staff-sm text-staff-muted">
          {hits.length - DISPLAY_MAX} more{" "}
          {hits.length - DISPLAY_MAX === 1 ? "profile" : "profiles"} also have similar names. Open
          an artist to see theirs.
        </p>
      ) : null}
    </div>
  );
}
