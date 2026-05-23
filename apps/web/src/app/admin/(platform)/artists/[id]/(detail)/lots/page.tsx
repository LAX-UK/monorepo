import { ArtistLotsTab } from "@/components/admin/artist-detail/tabs/lots-tab";
import { getAdminLotList } from "@/lib/data/http/admin.server";

export default async function AdminArtistLotsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lots = await getAdminLotList({ artistId: id, limit: 50 }).catch(() => []);

  return <ArtistLotsTab artistId={id} lots={lots} />;
}
