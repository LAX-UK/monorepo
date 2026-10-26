import { SaleroomHubView } from "@/components/admin/saleroom-hub-board/saleroom-hub-view";
import { loadSaleroomHubPage } from "@/lib/admin/saleroom/load-saleroom-hub-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom",
  "Monitor live rooms and open the clerk console for each sale.",
);

export default async function AdminSaleroomHubPage() {
  const model = await loadSaleroomHubPage();
  return <SaleroomHubView model={model} />;
}
