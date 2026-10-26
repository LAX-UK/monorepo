import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtistList } from "@/components/artists/artist-list.client";
import { loadArtistListPage } from "@/server/application/load-artwork-pages";
import { artistList } from "@/server/domain/artist-list.vm";
import { redirect } from "next/navigation";

export const metadata = { title: "Artists" };

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = artistList.parse(await searchParams);
  const result = await loadArtistListPage(state);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="Artists" status={result.status} />;
  return (
    <ArtistList
      state={state}
      page={result.data.page}
      loadFailed={result.data.loadFailed}
      canWrite={result.data.permissions.write}
    />
  );
}
