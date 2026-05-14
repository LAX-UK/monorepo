import { ArtistsDirectoryShell } from "@/components/sections/artists/artist-directory-shell";
import { KIND_SEGMENTS, presetForKindSlug } from "@/lib/artists/directory-presets";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return KIND_SEGMENTS.map((kind) => ({ kind }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  const preset = presetForKindSlug(kind);
  if (!preset) return { title: "Artists" };
  return metadataForStatic({
    title: preset.heroTitle,
    description: preset.heroDescription,
    path: preset.canonicalPath,
  });
}

export default async function ArtistsByKindPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ kind }, sp] = await Promise.all([params, searchParams]);
  const preset = presetForKindSlug(kind);
  if (!preset) notFound();
  return <ArtistsDirectoryShell preset={preset} searchParams={sp} />;
}
