import { AdminPinPageButton } from "@/components/admin/admin-pin-page-button";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { ArtistContextRail } from "@/components/admin/artist-detail/artist-context-rail";
import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import {
  CatalogBreadcrumbs,
  CatalogDetailMobileMeta,
  CatalogDetailShell,
  CatalogDetailStickyMiniBar,
  CatalogDetailTabNav,
  type CatalogMobileAction,
  CatalogPostCreateSessionRoot,
  CatalogWhatsNextBanner,
} from "@/components/admin/catalog";
import { AdminArtistEditableTitle } from "@/components/admin/editable-titles";
import { buildArtistProfileReadiness } from "@/lib/admin/catalog-readiness";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { ArtistDeleteEligibility, ArtistProfile, ArtistStatus } from "@auction/types";
import { Badge } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
  publicHref: string;
  activityEvents?: readonly AdminDomainEventRow[];
  deleteEligibility?: ArtistDeleteEligibility | null;
  canManageDelete?: boolean;
  canEdit?: boolean;
  children: ReactNode;
};

export function ArtistDetailShell({
  artistId,
  artist,
  lotCount,
  duplicateCount,
  publicHref,
  activityEvents = [],
  deleteEligibility = null,
  canManageDelete = false,
  canEdit = false,
  children,
}: Props) {
  const lifeRaw = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const life = lifeRaw === "—" ? null : lifeRaw;
  const registryStatus: ArtistStatus = artist.status ?? "pending";

  const artistMobileActions: CatalogMobileAction[] = [
    ...(canEdit
      ? [
          {
            id: "edit-artist",
            label: "Edit",
            href: `/admin/artists/${artist.id}/edit`,
            variant: "primary" as const,
          },
        ]
      : []),
    {
      id: "public-profile",
      label: "Public profile",
      href: publicHref,
    },
  ];

  const statusBadge = <AdminStatusBadge domain="artist" status={registryStatus} />;

  const tabSpecs = [
    { id: "overview", label: "Overview", href: artistDetailTabHref(artistId, "overview") },
    {
      id: "lots",
      label: `Lots${lotCount > 0 ? ` (${lotCount})` : ""}`,
      href: artistDetailTabHref(artistId, "lots"),
    },
    {
      id: "duplicates",
      label: `Duplicates${duplicateCount > 0 ? ` (${duplicateCount})` : ""}`,
      href: artistDetailTabHref(artistId, "duplicates"),
      ...(duplicateCount > 0 ? { badge: "warning" as const } : {}),
    },
    ...(registryStatus === "pending"
      ? [
          {
            id: "review",
            label: "Review",
            href: artistDetailTabHref(artistId, "review"),
            badge: "pending" as const,
          },
        ]
      : []),
  ];

  const profileReadiness = buildArtistProfileReadiness(artistId, artist);

  return (
    <CatalogPostCreateSessionRoot>
      <CatalogDetailShell
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Artists", href: "/admin/artists" }, { label: artist.displayName }]}
          />
        }
        eyebrow="Artist"
        title={<AdminArtistEditableTitle artistId={artist.id} value={artist.displayName} />}
        description={life ? `${life} · Registry overview` : "Registry overview"}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {artist.kind ? (
              <Badge variant="secondary">{artistKindMeta(artist.kind).badge}</Badge>
            ) : null}
            {statusBadge}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminPinPageButton label={artist.displayName} />
            {canEdit ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/artists/${artist.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href={publicHref} target="_blank" rel="noopener noreferrer">
                Public profile
              </Link>
            </Button>
          </div>
        }
        mobileActions={artistMobileActions}
        mobileMeta={
          <CatalogDetailMobileMeta
            entityId={artistId}
            updatedAt={artist.updatedAt}
            publicHref={publicHref}
            publicLabel="Public profile"
            status={statusBadge}
            primaryAction={
              registryStatus === "pending" ? (
                <Link
                  href={artistDetailTabHref(artistId, "review")}
                  className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
                >
                  Review profile →
                </Link>
              ) : undefined
            }
          />
        }
        aside={
          <ArtistContextRail
            artistId={artistId}
            artist={artist}
            lotCount={lotCount}
            duplicateCount={duplicateCount}
            publicHref={publicHref}
            status={statusBadge}
            activityEvents={activityEvents}
            deleteEligibility={deleteEligibility}
            canManageDelete={canManageDelete}
            canEdit={canEdit}
          />
        }
        stickySubnav={
          <>
            <CatalogDetailTabNav
              tabs={tabSpecs}
              entityKind="artist"
              entityId={artistId}
              aria-label="Artist sections"
            />
            <CatalogDetailStickyMiniBar
              items={[
                { id: "lots", label: "Lots", value: String(lotCount) },
                { id: "status", label: "Status", value: statusBadge },
              ]}
            />
          </>
        }
      >
        <Suspense fallback={null}>
          <CatalogWhatsNextBanner
            entityLabel="artist profile"
            readiness={profileReadiness}
            dismissKey={`artist:${artistId}`}
          />
        </Suspense>
        {children}
      </CatalogDetailShell>
    </CatalogPostCreateSessionRoot>
  );
}
