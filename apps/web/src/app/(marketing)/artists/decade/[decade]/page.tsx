import { ArtistsDirectoryShell } from "@/components/sections/artists/artist-directory-shell";
import { DECADE_SEGMENTS, decadePreset } from "@/lib/artists/directory-presets";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return DECADE_SEGMENTS.map((decade) => ({ decade }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ decade: string }>;
}): Promise<Metadata> {
  const { decade } = await params;
  const preset = decadePreset(decade);
  if (!preset) return { title: "Artists" };
  return metadataForStatic({
    title: preset.heroTitle,
    description: preset.heroDescription,
    path: preset.canonicalPath,
  });
}

export default async function ArtistsByDecadePage({
  params,
  searchParams,
}: {
  params: Promise<{ decade: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ decade }, sp] = await Promise.all([params, searchParams]);
  const preset = decadePreset(decade);
  if (!preset) notFound();
  return <ArtistsDirectoryShell preset={preset} searchParams={sp} />;
}
