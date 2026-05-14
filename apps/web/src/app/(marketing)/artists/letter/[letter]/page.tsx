import { ArtistsDirectoryShell } from "@/components/sections/artists/artist-directory-shell";
import { letterPreset } from "@/lib/artists/directory-presets";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

const VALID_LETTER = /^([a-z]|[0-9]|other)$/;

function normalizeLetter(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  if (!VALID_LETTER.test(lower)) return null;
  return lower;
}

export function generateStaticParams() {
  const letters = "abcdefghijklmnopqrstuvwxyz".split("");
  const digits = "0123456789".split("");
  return [...letters, ...digits, "other"].map((letter) => ({ letter }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ letter: string }>;
}): Promise<Metadata> {
  const { letter } = await params;
  const lower = normalizeLetter(letter);
  if (!lower) return { title: "Artists", robots: { index: false, follow: true } };
  const preset = letterPreset(lower);
  return metadataForStatic({
    title: preset.heroTitle,
    description: preset.heroDescription,
    path: preset.canonicalPath,
  });
}

export default async function ArtistsByLetterPage({
  params,
  searchParams,
}: {
  params: Promise<{ letter: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ letter }, sp] = await Promise.all([params, searchParams]);
  const lower = normalizeLetter(letter);
  if (!lower) notFound();
  const preset = letterPreset(lower);
  return <ArtistsDirectoryShell preset={preset} searchParams={sp} />;
}
