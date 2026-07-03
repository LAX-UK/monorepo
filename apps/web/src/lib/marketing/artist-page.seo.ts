import { fetchRegistryArtistById } from "@/lib/data/http/artist.server";
import { metadataForNotFound, metadataForSeller } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  creatorJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from "@/lib/seo/structured-data";
import { artistPath, lotPath, slugify } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Lot, ArtistProfile as RegistryArtist } from "@auction/types";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export function ensureCanonicalArtistSlug(slug: string, artist: { id: string; name: string }) {
  if (slug !== slugify(artist.name)) permanentRedirect(artistPath(artist));
}

/** `noindex` for any registry artist that shouldn't be ranked: merged, archived, rejected. */
export function shouldNoIndexArtist(registry: RegistryArtist | null): boolean {
  if (!registry) return false;
  if (registry.archived) return true;
  if (registry.status === "merged_into" || registry.status === "rejected") return true;
  return false;
}

export async function loadArtistDetailMetadata(id: string, slug: string): Promise<Metadata> {
  const registry = await fetchRegistryArtistById(id);
  if (!registry) return metadataForNotFound("Artist not found");
  ensureCanonicalArtistSlug(slug, { id: registry.id, name: registry.displayName });
  const base = metadataForSeller({ id: registry.id, name: registry.displayName });
  if (shouldNoIndexArtist(registry)) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

export type BuildArtistPageSeoInput = {
  artistName: string;
  profilePath: string;
  profileUrl: string;
  artistPortraitUrl: string | null;
  artistTagline: string | null;
  artistBio: string | null;
  registry: RegistryArtist;
  aliasesList: string[];
  artistLots: Lot[];
};

export function buildArtistPageJsonLd(input: BuildArtistPageSeoInput): string {
  const base = getSiteUrl();
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artists" },
    { name: input.artistName, path: input.profilePath },
  ]);

  const description: string | undefined =
    (input.artistTagline ?? input.artistBio)
      ? ((input.artistTagline ?? input.artistBio) as string)
      : undefined;
  const sameAs = input.registry.websiteUrl ? [input.registry.websiteUrl] : undefined;

  const subjectLd = creatorJsonLd({
    kind: input.registry.kind ?? null,
    name: input.artistName,
    url: input.profileUrl,
    ...(input.artistPortraitUrl ? { image: input.artistPortraitUrl } : {}),
    ...(description ? { description } : {}),
    ...(sameAs ? { sameAs } : {}),
    ...(input.aliasesList.length > 0 ? { alternateName: input.aliasesList } : {}),
    ...(input.registry.birthYear ? { birthDate: input.registry.birthYear } : {}),
    ...(input.registry.deathYear ? { deathDate: input.registry.deathYear } : {}),
    ...(input.registry.foundedYear ? { foundingDate: input.registry.foundedYear } : {}),
    ...(input.registry.dissolvedYear ? { dissolutionDate: input.registry.dissolvedYear } : {}),
    ...(input.registry.nationality ? { nationality: input.registry.nationality } : {}),
  });

  const itemsLd =
    input.artistLots.length > 0
      ? itemListJsonLd(
          input.artistLots.map((l) => ({ name: l.title, url: `${base}${lotPath(l)}` })),
        )
      : null;

  return jsonLdScript(...(itemsLd ? [crumbs, subjectLd, itemsLd] : [crumbs, subjectLd]));
}
