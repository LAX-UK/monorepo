import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtworkList } from "@/components/artworks/artwork-list.client";
import { ArtworksPageActions } from "@/components/artworks/artworks-page-actions.client";
import { loadArtworkListPage } from "@/server/application/load-artwork-pages";
import { parseArtworkListQuery } from "@/server/domain/artwork-list.vm";
import { PageHeader } from "@auction/staff-ui";
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
  const { page, selectedArtistName, permissions } = result.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Artworks"
        description="Every artwork on LAX Shop and lax.art, drafts and archived works included. Open one to edit its details, price, images and visibility."
        primaryAction={permissions.write ? <ArtworksPageActions /> : undefined}
      />
      <ArtworkList
        query={query}
        page={page}
        selectedArtistName={selectedArtistName}
        permissions={permissions}
      />
    </div>
  );
}
