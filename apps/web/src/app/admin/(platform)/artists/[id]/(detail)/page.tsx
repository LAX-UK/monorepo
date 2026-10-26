import { ArtistOverviewTab } from "@/components/admin/artist-detail/tabs/overview-tab";
import { StaffActionError } from "@/components/admin/staff/staff-action-error";
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
      <StaffActionError error={sp.error} title="The artist was not updated" />
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
