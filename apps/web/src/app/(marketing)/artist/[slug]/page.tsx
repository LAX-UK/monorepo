import { fetchArtistBySlug } from "@/lib/data/http/artist.reader";
import { metadataForNotFound } from "@/lib/seo/metadata-factory";
import { artistPath } from "@/lib/seo/url";
import { appendMarketingParamsToPath } from "@auction/validators";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = metadataForNotFound(
  "Artist",
  "Canonical artist catalogue URL — you will be redirected.",
);

export default async function ArtistSlugRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  if (process.env.NEXT_PUBLIC_ENABLE_ARTISTS === "false") notFound();

  const artist = await fetchArtistBySlug(slug);
  if (!artist) notFound();

  redirect(
    appendMarketingParamsToPath(artistPath({ id: artist.id, name: artist.displayName }), sp),
  );
}
