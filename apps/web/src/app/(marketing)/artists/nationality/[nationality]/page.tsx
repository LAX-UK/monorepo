import { ArtistsDirectoryShell } from "@/components/sections/artists/artist-directory-shell";
import { NATIONALITY_SEGMENTS, nationalityPreset } from "@/lib/artists/directory-presets";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return NATIONALITY_SEGMENTS.map((n) => ({ nationality: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ nationality: string }>;
}): Promise<Metadata> {
  const { nationality } = await params;
  const preset = nationalityPreset(nationality);
  if (!preset) return { title: "Artists", robots: { index: false, follow: true } };
  return metadataForStatic({
    title: preset.heroTitle,
    description: preset.heroDescription,
    path: preset.canonicalPath,
  });
}

export default async function ArtistsByNationalityPage({
  params,
  searchParams,
}: {
  params: Promise<{ nationality: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ nationality }, sp] = await Promise.all([params, searchParams]);
  const preset = nationalityPreset(nationality);
  if (!preset) notFound();
  return <ArtistsDirectoryShell preset={preset} searchParams={sp} />;
}
