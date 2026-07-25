import { getServerApiBase } from "@/lib/data/http/hc-server";
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

  const res = await fetch(`${getServerApiBase()}/artists/by-slug/${encodeURIComponent(slug)}`, {
    next: { revalidate: 120 },
  });
  if (!res.ok) notFound();

  const body = (await res.json()) as { data: { id: string; displayName: string } };
  redirect(
    appendMarketingParamsToPath(artistPath({ id: body.data.id, name: body.data.displayName }), sp),
  );
}
