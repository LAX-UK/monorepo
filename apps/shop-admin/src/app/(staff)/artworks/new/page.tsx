import { AdminFailedPage } from "@/components/admin-fetch-state";
import { ArtworkEditor } from "@/components/artworks/artwork-editor.client";
import { loadNewArtworkPage } from "@/server/application/load-artwork-pages";
import { singleParam } from "@/server/domain/list-url-state";
import { redirect } from "next/navigation";

export const metadata = { title: "New artwork" };

export default async function NewArtworkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await loadNewArtworkPage(singleParam((await searchParams).artist));
  if (result.status === "unauthorized") redirect("/login");
  if (result.status !== "ok") return <AdminFailedPage title="New artwork" status={result.status} />;
  if (!result.data.permissions.write) {
    return <AdminFailedPage title="New artwork" status="forbidden" />;
  }
  return (
    <ArtworkEditor
      detail={null}
      initialArtist={result.data.initialArtist}
      permissions={result.data.permissions}
      currentYear={new Date().getFullYear()}
    />
  );
}
