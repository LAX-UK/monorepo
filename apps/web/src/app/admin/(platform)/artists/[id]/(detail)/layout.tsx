import { ArtistDetailShell } from "@/components/admin/artist-detail/artist-detail-shell";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminDomainEventsForAggregate,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { artistPath } from "@/lib/seo/url";
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

  const publicHref = artistPath({ id: artist.id, name: artist.displayName });

  return (
    <ArtistDetailShell
      artistId={id}
      artist={artist}
      lotCount={lots.length}
      duplicateCount={dupes.length}
      publicHref={publicHref}
      activityEvents={activityEvents}
    >
      {children}
    </ArtistDetailShell>
  );
}
