import { ArtistDuplicatesTab } from "@/components/admin/artist-detail/tabs/duplicates-tab";
import { loadAdminArtistDuplicatesPage } from "@/lib/admin/artists/load-artist-duplicates-page";
import { notFound } from "next/navigation";

export default async function AdminArtistDuplicatesPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadAdminArtistDuplicatesPage(id);
  if (!model) notFound();

  return (
    <ArtistDuplicatesTab
      artistId={model.artistId}
      displayName={model.displayName}
      dupes={model.dupes}
    />
  );
}
