import { ArtistOverviewTab } from "@/components/admin/artist-detail/tabs/overview-tab";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import { loadAdminArtistDetailContext } from "@/lib/admin/artists/load-artist-detail-context";
import { getAdminDomainEventsForAggregate } from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminArtistOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [detail, activityEvents] = await Promise.all([
    loadAdminArtistDetailContext(id),
    getAdminDomainEventsForAggregate({ aggregateType: "artist", aggregateId: id, limit: 5 }).catch(
      () => [],
    ),
  ]);
  if (!detail) notFound();
  const { artist, lotCount, duplicates } = detail;

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not update artist" />
      <ArtistOverviewTab
        artistId={id}
        artist={artist}
        lotCount={lotCount}
        duplicateCount={duplicates.length}
        activityEvents={activityEvents}
      />
    </>
  );
}
