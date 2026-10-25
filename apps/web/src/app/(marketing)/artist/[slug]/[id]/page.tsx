import { ArtistDetailView } from "@/components/sections/artists/artist-detail-view";
import { loadArtistDetailMetadata } from "@/lib/marketing/artist-page.seo";
import { loadArtistDetailPage } from "@/lib/marketing/load-artist-detail-page";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  return loadArtistDetailMetadata(id, slug, await searchParams);
}

export default async function ArtistPage({ params, searchParams }: PageProps) {
  const { id, slug } = await params;
  const data = await loadArtistDetailPage({ id, slug, searchParams: await searchParams });
  return <ArtistDetailView {...data} />;
}
