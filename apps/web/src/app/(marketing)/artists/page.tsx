import { ArtistsDirectoryShell } from "@/components/sections/artists/artist-directory-shell";
import { artistDirectoryPresetById } from "@/lib/artists/directory-presets";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

const preset = artistDirectoryPresetById("all");

export function generateMetadata(): Metadata {
  return metadataForStatic({
    title: preset.heroTitle,
    description: preset.heroDescription,
    path: preset.canonicalPath,
  });
}

export default async function PublicArtistsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return <ArtistsDirectoryShell preset={preset} searchParams={sp} />;
}
