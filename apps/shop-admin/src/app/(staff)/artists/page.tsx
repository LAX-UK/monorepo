import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtistList } from "@/components/artists/artist-list.client";
import { loadArtistListPage } from "@/server/application/load-artwork-pages";
import { parseArtistListQuery } from "@/server/domain/artist-list.vm";
import { redirect } from "next/navigation";

export const metadata = { title: "Artists" };

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseArtistListQuery(await searchParams);
  const result = await loadArtistListPage(query);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Artists" status={result.status} />;
  return (
    <ArtistList query={query} page={result.data.page} canWrite={result.data.permissions.write} />
  );
}
