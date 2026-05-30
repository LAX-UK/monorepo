import { ArtistDetailShell } from "@/components/admin/artist-detail/artist-detail-shell";
import {
  getAdminArtistById,
  getAdminArtistDeleteEligibility,
  getAdminArtistDuplicateCandidates,
  getAdminDomainEventsForAggregate,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { ARTIST_DELETE_ACCESS } from "@/lib/navigation/staff-nav-access";
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
  const [artist, lots, dupes, activityEvents] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 50 }).catch(() => []),
    getAdminArtistDuplicateCandidates(id).catch(() => []),
    getAdminDomainEventsForAggregate({ aggregateType: "artist", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
  ]);
  if (!artist) notFound();

  const user = await getServerSessionUser();
  const canManageDelete =
    user != null &&
    userHasAccessTo(user.role as UserRole, user.staffRole ?? null, ARTIST_DELETE_ACCESS);
  const deleteEligibility = canManageDelete
    ? await getAdminArtistDeleteEligibility(id).catch(() => null)
    : null;

  const publicHref = artistPath({ id: artist.id, name: artist.displayName });

  return (
    <ArtistDetailShell
      artistId={id}
      artist={artist}
      lotCount={lots.length}
      duplicateCount={dupes.length}
      publicHref={publicHref}
      activityEvents={activityEvents}
      deleteEligibility={deleteEligibility}
      canManageDelete={canManageDelete}
    >
      {children}
    </ArtistDetailShell>
  );
}
