import { getServerLotById } from "@/lib/data/http/lots.server";
import { metadataForLot, metadataForNotFound } from "@/lib/seo/metadata-factory";
import { lotPath } from "@/lib/seo/url";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const auction = await getServerLotById(id);
  if (!auction) return metadataForNotFound("Lot not found");
  return {
    ...metadataForLot(auction),
    robots: { index: false, follow: true },
  };
}

export default async function ArtworkLegacyRedirect({ params }: PageProps) {
  const { id } = await params;
  const auction = await getServerLotById(id);
  if (!auction) notFound();
  permanentRedirect(lotPath(auction));
}
