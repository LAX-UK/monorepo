import { ActivityTimelinePanel } from "@/components/admin/activity-timeline-panel";
import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { AdminArtistReviewPanel } from "@/components/admin/admin-artist-review-panel";
import { AdminEntityDetailShell } from "@/components/admin/admin-entity-detail-shell";
import { AdminDetailTabs } from "@/components/dashboard/primitives/admin-detail-tabs";
import { artistStatusLabel, artistStatusToBadgeVariant } from "@/lib/admin/status-badge-variants";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { artistPath } from "@/lib/seo/url";
import type { ArtistStatus } from "@auction/types";
import { Badge, StatusBadge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function AdminArtistDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, lots, dupes] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 50 }).catch(() => []),
    getAdminArtistDuplicateCandidates(id).catch(() => []),
  ]);
  if (!artist) notFound();

  const lifeRaw = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const life = lifeRaw === "—" ? null : lifeRaw;
  const publicHref = artistPath({ id: artist.id, name: artist.displayName });
  const registryStatus: ArtistStatus = artist.status ?? "pending";

  const mergedBanner =
    artist.status === "merged_into" && artist.mergedIntoArtistId ? (
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-4 text-sm text-on-surface">
        This profile was merged. All catalogue work should happen on the surviving profile.{" "}
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="font-medium text-primary hover:underline"
        >
          View surviving artist →
        </Link>
      </div>
    ) : null;

  return (
    <AdminEntityDetailShell
      breadcrumbs={
        <div className="flex flex-wrap gap-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
          <Link href="/admin/artists" className="text-primary hover:underline">
            ← Artists
          </Link>
          <span className="text-on-surface-variant">/</span>
          <span className="text-on-surface">{artist.displayName}</span>
        </div>
      }
      title={artist.displayName}
      description={life ? `${life} · Registry overview` : "Registry overview"}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {artist.kind ? (
            <Badge variant="secondary">{artistKindMeta(artist.kind).badge}</Badge>
          ) : null}
          <StatusBadge variant={artistStatusToBadgeVariant(registryStatus)}>
            {artistStatusLabel[registryStatus]}
          </StatusBadge>
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/artists/${artist.id}/edit`}>Edit</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={publicHref} target="_blank" rel="noopener noreferrer">
              Public profile
            </Link>
          </Button>
        </div>
      }
    >
      <AdminDetailTabs
        defaultValue="overview"
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <div className="space-y-6">
                {mergedBanner}

                <Surface variant="card">
                  <h3 className="font-display text-lg font-semibold text-on-surface">Profile</h3>
                  <div className="grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-on-surface">Slug</span>
                      <br />
                      <span className="font-mono text-xs">/{artist.slug}</span>
                    </p>
                    <p>
                      <span className="font-medium text-on-surface">Nationality</span>
                      <br />
                      {artist.nationality?.trim() || "—"}
                    </p>
                    <p>
                      <span className="font-medium text-on-surface">Featured / verified</span>
                      <br />
                      {artist.featured ? "Featured" : "Not featured"}
                      {" · "}
                      {artist.verified ? "Verified" : "Not verified"}
                    </p>
                    <p>
                      <span className="font-medium text-on-surface">Archived</span>
                      <br />
                      {artist.archived ? "Yes" : "No"}
                    </p>
                  </div>
                </Surface>

                {artist.status === "pending" ? (
                  <AdminArtistReviewPanel artistId={artist.id} currentStatus={artist.status} />
                ) : null}
              </div>
            ),
          },
          {
            value: "lots",
            label: `Lots${lots.length > 0 ? ` (${lots.length})` : ""}`,
            content: (
              <div className="space-y-3">
                <p className="text-sm text-on-surface-variant">
                  Read-only FK attribution. Reassign from each lot&apos;s edit screen.
                </p>
                <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
              </div>
            ),
          },
          {
            value: "duplicates",
            label: `Duplicates${dupes.length > 0 ? ` (${dupes.length})` : ""}`,
            content: (
              <div className="space-y-4">
                <p className="text-sm text-on-surface-variant">
                  Server-suggested candidates with similar names. Merging moves aliases and lots to
                  the surviving profile.
                </p>
                {dupes.length === 0 ? (
                  <p className="rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
                    No duplicate candidates returned for this profile.
                  </p>
                ) : (
                  <AdminArtistDuplicatesTable rows={dupes} />
                )}
                <AdminArtistMergePanel
                  fromArtistId={artist.id}
                  fromDisplayName={artist.displayName}
                />
              </div>
            ),
          },
          {
            value: "activity",
            label: "Activity",
            content: <ActivityTimelinePanel aggregateType="artist" aggregateId={artist.id} />,
          },
        ]}
      />
    </AdminEntityDetailShell>
  );
}
