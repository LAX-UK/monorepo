import { ArtistDetailShell } from "@/components/admin/artist-detail/artist-detail-shell";
import { adminArtistHref } from "@/lib/admin/artists/artists-staff-list.vm";
import { loadAdminArtistDetailContext } from "@/lib/admin/artists/load-artist-detail-context";
import { loadArtistsListIds } from "@/lib/admin/catalog/load-artists-list-page";
import { loadListRecordPager, requestListQuery } from "@/lib/admin/list-record-pager.server";
import { getAdminArtistDeleteEligibility } from "@/lib/data/http/admin.server";
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
  const detail = await loadAdminArtistDetailContext(id);
  if (!detail) notFound();
  const { artist, lotCount, duplicates } = detail;

  const user = await getServerSessionUser();
  const canEdit =
    user != null && userHasAccessTo(user.role as UserRole, user.staffRoles, ARTIST_WRITE_ACCESS);
  const canManageDelete =
    user != null && userHasAccessTo(user.role as UserRole, user.staffRoles, ARTIST_DELETE_ACCESS);
  const canReview =
    user != null && userHasAccessTo(user.role as UserRole, user.staffRoles, ARTIST_REVIEW_ACCESS);
  const [deleteEligibility, pager] = await Promise.all([
    canManageDelete ? getAdminArtistDeleteEligibility(id).catch(() => null) : null,
    // Opened from the artists list: Previous and Next through that list.
    requestListQuery().then((listQuery) =>
      loadListRecordPager({
        listQuery,
        currentId: id,
        recordHref: adminArtistHref,
        loadIds: loadArtistsListIds,
      }),
    ),
  ]);

  const publicHref = artistPath({ id: artist.id, name: artist.displayName });

  return (
    <ArtistDetailShell
      artistId={id}
      artist={artist}
      lotCount={lotCount}
      duplicateCount={duplicates.length}
      publicHref={publicHref}
      deleteEligibility={deleteEligibility}
      canManageDelete={canManageDelete}
      canEdit={canEdit}
      canReview={canReview}
      pager={pager}
    >
      {children}
    </ArtistDetailShell>
  );
}
