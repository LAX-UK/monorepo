import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtworkList } from "@/components/artworks/artwork-list.client";
import { loadArtworkListPage } from "@/server/application/load-artwork-pages";
import { parseArtworkListQuery } from "@/server/domain/artwork-list.vm";
import { redirect } from "next/navigation";

export const metadata = { title: "Artworks" };

export default async function ShopAdminArtworksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseArtworkListQuery(await searchParams);
  const result = await loadArtworkListPage(query);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Artworks" status={result.status} />;
  const { page, loadFailed, selectedArtistName, permissions } = result.data;

  return (
    <ArtworkList
      query={query}
      page={page}
      loadFailed={loadFailed}
      selectedArtistName={selectedArtistName}
      permissions={permissions}
    />
  );
}
