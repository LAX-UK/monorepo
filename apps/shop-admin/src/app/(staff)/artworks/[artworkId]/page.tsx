import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtworkEditor } from "@/components/artworks/artwork-editor.client";
import { loadArtworkEditorPage } from "@/server/application/load-artwork-pages";
import { notFound, redirect } from "next/navigation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: "Artwork" };

export default async function ArtworkEditorPage({
  params,
}: {
  params: Promise<{ artworkId: string }>;
}) {
  const { artworkId } = await params;
  if (!UUID.test(artworkId)) notFound();
  const result = await loadArtworkEditorPage(artworkId);
  if (result.status === "unauthorized") redirect("/login");
  if (result.status === "not_found") notFound();
  if (result.status !== "ok") return <AdminFailedPage title="Artwork" status={result.status} />;
  const { detail, permissions } = result.data;
  return (
    <ArtworkEditor
      key={detail?.artworkId}
      detail={detail}
      permissions={permissions}
      currentYear={new Date().getFullYear()}
    />
  );
}
