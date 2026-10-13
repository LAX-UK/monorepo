import type { LegacyArtwork, LegacyThelaxExport } from "./legacy-thelax-export.js";
import {
  LEGACY_PAGE_RULES,
  LEGACY_PATH_OVERRIDES,
  artistPath,
  artworkPath,
  collectorHubPath,
  legacyPageRule,
  legalPath,
  plannedArtworkSlug,
  storyPath,
  taxonomyPageSlug,
} from "./legacy-thelax-url-map.js";

export const LEGACY_REDIRECTS_SCHEMA_VERSION = 1;

/** Legacy path → new site path (or absolute URL for media and sibling LAX sites). */
export type LegacyRedirectMap = Record<string, string>;

export type LegacyRedirectsFile = {
  schemaVersion: typeof LEGACY_REDIRECTS_SCHEMA_VERSION;
  generatedAt: string;
  origin: string;
  redirects: LegacyRedirectMap;
};

const CATALOGUE_FALLBACK_PATH = "/artworks";

/** `/collections/<slug>.html` → `<slug>` (artists referenced by works but never crawled). */
export function artistSlugFromLegacyPath(path: string): string | null {
  return /^\/collections\/([^/]+)\.html$/.exec(path)?.[1]?.toLowerCase() ?? null;
}

export function legacyArtistSlugs(data: LegacyThelaxExport): Map<string, string> {
  const slugs = new Map(data.artists.map((artist) => [artist.legacyPath, artist.slug]));
  for (const artwork of data.artworks) {
    const path = artwork.artistLegacyPath;
    if (!path || slugs.has(path)) continue;
    const slug = artistSlugFromLegacyPath(path);
    if (slug) slugs.set(path, slug);
  }
  return slugs;
}

/** Legacy artwork path → catalogue slug, applying the print/original collision rule. */
export function plannedArtworkSlugs(artworks: readonly LegacyArtwork[]): Map<string, string> {
  const originalSlugs = new Set(artworks.filter((a) => a.kind !== "print").map((a) => a.slug));
  return new Map(
    artworks.map((artwork) => [
      artwork.legacyPath,
      plannedArtworkSlug(artwork.kind, artwork.slug, originalSlugs),
    ]),
  );
}

export function legacyPageTarget(slug: string): string | null {
  const rule = legacyPageRule(slug);
  switch (rule?.kind) {
    case "page":
      return collectorHubPath(rule.slug);
    case "legal":
      return legalPath(rule.slug);
    case "route":
      return rule.to;
    default:
      return null;
  }
}

/**
 * Every legacy URL with a new equivalent. Artworks missing from `artworkSlugs` (not imported)
 * get no entry so they 404 honestly rather than pointing at someone else's page.
 */
export function buildLegacyRedirects(
  data: LegacyThelaxExport,
  input: {
    artworkSlugs: ReadonlyMap<string, string>;
    imageUrls?: ReadonlyMap<string, string>;
    overrides?: Readonly<Record<string, string>>;
  },
): LegacyRedirectMap {
  const redirects = new Map<string, string>();
  const artistSlugs = legacyArtistSlugs(data);

  for (const artwork of data.artworks) {
    const slug = input.artworkSlugs.get(artwork.legacyPath);
    if (slug) redirects.set(artwork.legacyPath, artworkPath(slug));
  }
  for (const [legacyPath, slug] of artistSlugs) redirects.set(legacyPath, artistPath(slug));
  for (const series of data.series) {
    const owner = series.artistLegacyPath ? artistSlugs.get(series.artistLegacyPath) : undefined;
    redirects.set(series.legacyPath, owner ? artistPath(owner) : CATALOGUE_FALLBACK_PATH);
  }
  for (const taxonomy of data.taxonomies) {
    redirects.set(
      taxonomy.legacyPath,
      collectorHubPath(taxonomyPageSlug(taxonomy.taxonomy, taxonomy.slug)),
    );
  }
  for (const story of data.stories) redirects.set(story.legacyPath, storyPath(story.slug));
  for (const page of data.pages) {
    const target = legacyPageTarget(page.slug);
    if (target) redirects.set(page.legacyPath, target);
  }
  for (const [slug, rule] of Object.entries(LEGACY_PAGE_RULES)) {
    if (rule.kind === "route") redirects.set(`/${slug}`, rule.to);
  }
  for (const [legacyPath, url] of input.imageUrls ?? []) redirects.set(legacyPath, url);
  for (const [legacyPath, to] of Object.entries(input.overrides ?? LEGACY_PATH_OVERRIDES)) {
    redirects.set(legacyPath, to);
  }

  return Object.fromEntries([...redirects].sort(([a], [b]) => a.localeCompare(b)));
}

export function legacyRedirectsFile(
  data: LegacyThelaxExport,
  redirects: LegacyRedirectMap,
  generatedAt: Date,
): LegacyRedirectsFile {
  return {
    schemaVersion: LEGACY_REDIRECTS_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    origin: data.origin,
    redirects,
  };
}
