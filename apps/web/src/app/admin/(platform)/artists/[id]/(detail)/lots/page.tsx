import { ArtistLotsTab } from "@/components/admin/artist-detail/tabs/lots-tab";
import { loadAdminArtistLotsPage } from "@/lib/admin/artists/load-artist-lots-page";

export default async function AdminArtistLotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadAdminArtistLotsPage(id);
  return <ArtistLotsTab artistId={model.artistId} lots={model.lots} />;
}
