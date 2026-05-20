import { AdminArtistDuplicatesTable } from "@/components/admin/admin-artist-duplicates-table";
import { AdminArtistLotsPanel } from "@/components/admin/admin-artist-lots-panel";
import { AdminArtistMergePanel } from "@/components/admin/admin-artist-merge-panel";
import { AdminArtistReviewPanel } from "@/components/admin/admin-artist-review-panel";
import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  CatalogDetailShell,
  CatalogInfoAside,
  type CatalogMobileAction,
} from "@/components/admin/catalog";
import { AdminArtistEditableTitle } from "@/components/admin/editable-titles";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { artistPath } from "@/lib/seo/url";
import type { ArtistStatus } from "@auction/types";
import { Badge } from "@auction/ui";
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

  const artistMobileActions: CatalogMobileAction[] = [
    {
      id: "edit-artist",
      label: "Edit",
      href: `/admin/artists/${artist.id}/edit`,
      variant: "primary",
    },
    {
      id: "public-profile",
      label: "Public profile",
      href: publicHref,
    },
  ];

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
    <CatalogDetailShell
      breadcrumbs={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
          <Link href="/admin/artists" className="text-primary hover:underline">
            ← Artists
          </Link>
          <span className="text-on-surface-variant">/</span>
          <span className="truncate text-on-surface">{artist.displayName}</span>
        </span>
      }
      eyebrow="Artist"
      title={<AdminArtistEditableTitle artistId={artist.id} value={artist.displayName} />}
      description={life ? `${life} · Registry overview` : "Registry overview"}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {artist.kind ? (
            <Badge variant="secondary">{artistKindMeta(artist.kind).badge}</Badge>
          ) : null}
          <AdminStatusBadge domain="artist" status={registryStatus} />
        </div>
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <AdminPinPageButton label={artist.displayName} />
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
      mobileActions={artistMobileActions}
      aside={
        <CatalogInfoAside
          entityId={artist.id}
          updatedAt={artist.updatedAt}
          publicHref={publicHref}
          publicLabel="Public profile"
          status={<AdminStatusBadge domain="artist" status={registryStatus} />}
        />
      }
    >
      <div className="space-y-12">
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
            Overview
          </h2>
          <div className="space-y-6">
            {mergedBanner}

            <Surface variant="card">
              <h3 className="font-display text-lg font-semibold text-on-surface">Profile</h3>
              <div className="mt-4 grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
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
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
            Lots{lots.length > 0 ? ` (${lots.length})` : ""}
          </h2>
          <p className="text-sm text-on-surface-variant">
            Read-only FK attribution. Reassign from each lot&apos;s edit screen.
          </p>
          <AdminArtistLotsPanel artistId={artist.id} lots={lots} />
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-on-surface">
            Duplicates{dupes.length > 0 ? ` (${dupes.length})` : ""}
          </h2>
          <p className="text-sm text-on-surface-variant">
            Server-suggested candidates with similar names. Merging moves aliases and lots to the
            surviving profile.
          </p>
          {dupes.length === 0 ? (
            <p className="rounded-md border border-dashed border-outline-variant/40 p-4 text-sm text-on-surface-variant">
              No duplicate candidates returned for this profile.
            </p>
          ) : (
            <AdminArtistDuplicatesTable rows={dupes} />
          )}
          <AdminArtistMergePanel fromArtistId={artist.id} fromDisplayName={artist.displayName} />
        </section>
      </div>
    </CatalogDetailShell>
  );
}
