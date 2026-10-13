import { ArtArtworksCataloguePage } from "@/components/catalogue/art-artworks-catalogue-page";
import { composeArtworksPageMetadata } from "@/lib/catalogue/artworks-page.composer";
import type { Metadata } from "next";

const meta = composeArtworksPageMetadata({ objectType: "painting" });

export const metadata: Metadata = {
  title: meta.title,
  ...(meta.description ? { description: meta.description } : {}),
  alternates: { canonical: meta.canonical },
};

type PaintingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaintingsPage({ searchParams }: PaintingsPageProps) {
  return <ArtArtworksCataloguePage params={{ ...(await searchParams), objectType: "painting" }} />;
}
