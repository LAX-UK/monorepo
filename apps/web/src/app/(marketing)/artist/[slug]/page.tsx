import { getServerApiBase } from "@/lib/data/http/hc-server";
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

  const res = await fetch(`${getServerApiBase()}/artists/by-slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) notFound();

  const body = (await res.json()) as { data: { id: string; displayName: string } };
  redirect(artistPath({ id: body.data.id, name: body.data.displayName }));
}
