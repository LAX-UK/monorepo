import { ArtistDuplicatesTab } from "@/components/admin/artist-detail/tabs/duplicates-tab";
import {
  getAdminArtistById,
  getAdminArtistDuplicateCandidates,
} from "@/lib/data/http/admin.server";
import { notFound } from "next/navigation";

export default async function AdminArtistDuplicatesPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, dupes] = await Promise.all([
    getAdminArtistById(id),
    getAdminArtistDuplicateCandidates(id).catch(() => []),
  ]);
  if (!artist) notFound();

  return <ArtistDuplicatesTab artistId={id} displayName={artist.displayName} dupes={dupes} />;
}
