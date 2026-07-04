import { fetchArtistBySlug } from "@/lib/data/http/artist.server";
import { metadataForNotFound } from "@/lib/seo/metadata-factory";
import { artistPath } from "@/lib/seo/url";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = metadataForNotFound(
  "Artist",
  "Canonical artist catalogue URL — you will be redirected.",
);

export default async function ArtistSlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") notFound();

  const artist = await fetchArtistBySlug(slug);
  if (!artist) notFound();

  redirect(artistPath({ id: artist.id, name: artist.displayName }));
}
