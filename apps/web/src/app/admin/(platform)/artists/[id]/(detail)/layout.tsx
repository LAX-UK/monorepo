import { ArtistDetailShell } from "@/components/admin/artist-detail/artist-detail-shell";
import { loadAdminArtistDetailContext } from "@/lib/admin/artists/load-artist-detail-context";
import {
  getAdminArtistDeleteEligibility,
  getAdminDomainEventsForAggregate,
} from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  ARTIST_DELETE_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { artistPath } from "@/lib/seo/url";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  params: Promise<{ id: string }>;
  children: ReactNode;
};

export default async function AdminArtistDetailLayout({ params, children }: Props) {
  const { id } = await params;
  const [detail, activityEvents] = await Promise.all([
    loadAdminArtistDetailContext(id),
    getAdminDomainEventsForAggregate({ aggregateType: "artist", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
  ]);
  if (!detail) notFound();
  const { artist, lotCount, duplicates } = detail;

  const user = await getServerSessionUser();
  const canEdit =
    user != null &&
    userHasAccessTo(user.role as UserRole, user.staffRole ?? null, ARTIST_WRITE_ACCESS);
  const canManageDelete =
    user != null &&
    userHasAccessTo(user.role as UserRole, user.staffRole ?? null, ARTIST_DELETE_ACCESS);
  const canReview =
    user != null &&
    userHasAccessTo(user.role as UserRole, user.staffRole ?? null, ARTIST_REVIEW_ACCESS);
  const deleteEligibility = canManageDelete
    ? await getAdminArtistDeleteEligibility(id).catch(() => null)
    : null;

  const publicHref = artistPath({ id: artist.id, name: artist.displayName });

  return (
    <ArtistDetailShell
      artistId={id}
      artist={artist}
      lotCount={lotCount}
      duplicateCount={duplicates.length}
      publicHref={publicHref}
      activityEvents={activityEvents}
      deleteEligibility={deleteEligibility}
      canManageDelete={canManageDelete}
      canEdit={canEdit}
      canReview={canReview}
    >
      {children}
    </ArtistDetailShell>
  );
}
