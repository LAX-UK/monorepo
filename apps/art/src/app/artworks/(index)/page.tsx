import { ArtArtworksCataloguePage } from "@/components/catalogue/art-artworks-catalogue-page";
import { composeArtworksPageMetadata } from "@/lib/catalogue/artworks-page.composer";
import type { Metadata } from "next";

type ArtworksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ArtworksPageProps): Promise<Metadata> {
  const meta = composeArtworksPageMetadata(await searchParams);
  return {
    title: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
    alternates: { canonical: meta.canonical },
  };
}

export default async function ArtworksPage({ searchParams }: ArtworksPageProps) {
  return <ArtArtworksCataloguePage params={await searchParams} />;
}
