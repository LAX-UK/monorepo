import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtistRecordPage } from "@/components/artists/artist-record-page.client";
import { loadArtistPage } from "@/server/application/load-artwork-pages";
import { notFound, redirect } from "next/navigation";

export const metadata = { title: "Artist" };

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  const { artistId } = await params;
  const result = await loadArtistPage(artistId);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") {
    return <AdminFailedPage title="Artist" status={result.status} />;
  }
  return <ArtistRecordPage detail={result.data.detail} canWrite={result.data.permissions.write} />;
}
