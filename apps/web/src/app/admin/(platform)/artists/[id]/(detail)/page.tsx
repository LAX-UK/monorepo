import { ArtistOverviewTab } from "@/components/admin/artist-detail/tabs/overview-tab";
import { loadAdminArtistDetailContext } from "@/lib/admin/artists/load-artist-detail-context";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminArtistOverviewPage({ params }: Props) {
  const { id } = await params;
  const [detail, activityEvents] = await Promise.all([
    loadAdminArtistDetailContext(id),
    getAdminDomainEventsForAggregate({ aggregateType: "artist", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
  ]);
  if (!detail) notFound();
  const { artist, lotCount, duplicates } = detail;

  return (
    <ArtistOverviewTab
      artistId={id}
      artist={artist}
      lotCount={lotCount}
      duplicateCount={duplicates.length}
      activityEvents={activityEvents}
    />
  );
}
