import { ArtistOverviewTab } from "@/components/admin/artist-detail/tabs/overview-tab";
import { CatalogDetailActionError } from "@/components/admin/catalog/catalog-detail-action-error";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
  getAdminLotList,
} from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminArtistOverviewPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const [artist, lots, dupes] = await Promise.all([
    getAdminArtistById(id),
    getAdminLotList({ artistId: id, limit: 50 }).catch(() => []),
    getAdminArtistDuplicateCandidates(id).catch(() => []),
  ]);
  if (!artist) notFound();

  return (
    <>
      <CatalogDetailActionError error={sp.error} title="Could not update artist" />
      <ArtistOverviewTab
        artistId={id}
        artist={artist}
        lotCount={lots.length}
        duplicateCount={dupes.length}
      />
    </>
  );
}
