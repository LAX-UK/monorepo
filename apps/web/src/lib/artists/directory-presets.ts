import {
  type ArtistKind,
  artistKinds,
  getCreatorKindConfig,
  slugifyRecordKey,
} from "@auction/types";

/** A single, declarative description of a public directory slice (OCP).
 * Adding a new slice means adding one entry here, not branching JSX or
 * route-loaders. Each preset declares its filter, breadcrumbs, and SEO copy
 * so the route + shell can stay generic. */
export type ArtistDirectoryPresetId =
  | "all"
  | "featured"
  | "living"
  | "historical"
  | "kind-artists"
  | "kind-makers"
  | "kind-brands"
  | "kind-marques"
  | "letter"
  | "decade"
  | "nationality";

export type ArtistDirectoryPreset = {
  id: ArtistDirectoryPresetId;
  /** Canonical path for this slice, used as `<link rel="canonical">` and breadcrumb. */
  canonicalPath: string;
  /** Short label rendered in the segmented control. */
  label: string;
  /** Hero H1 + breadcrumb tail. */
  heroTitle: string;
  /** SEO description (140–160 chars). */
  heroDescription: string;
  /** Concrete filter applied on top of the base "approved + non-archived" set. */
  filter: {
    kinds?: ArtistKind[];
    living?: boolean;
    historical?: boolean;
    featuredOnly?: boolean;
    featuredFirst?: boolean;
    letter?: string;
    /** Decade slug like `1900s`, `pre-1800`. When set, the slice is decade-locked. */
    decade?: string;
    /** Nationality value (e.g. "British", "French"). When set, the slice is nationality-locked. */
    nationality?: string;
  };
};

export const ARTIST_DIRECTORY_PRESETS: ReadonlyArray<ArtistDirectoryPreset> = [
  {
    id: "all",
    canonicalPath: "/artists",
    label: "All",
    heroTitle: "Artists & Makers",
    heroDescription:
      "Explore the artists, makers, brands, marques, authors, mints, and producers behind LAX.BID auction lots.",
    filter: {},
  },
  {
    id: "featured",
    canonicalPath: "/artists/featured",
    label: "Featured",
    heroTitle: "Featured artists",
    heroDescription:
      "A curated spotlight on artists, makers, and brands the LAX.BID specialist team is following right now.",
    filter: { featuredOnly: true, featuredFirst: true },
  },
  {
    id: "living",
    canonicalPath: "/artists/living",
    label: "Living artists",
    heroTitle: "Living artists",
    heroDescription:
      "Browse contemporary artists actively making and exhibiting work — ordered alphabetically by default.",
    filter: { living: true },
  },
  {
    id: "historical",
    canonicalPath: "/artists/historical",
    label: "Historical & deceased",
    heroTitle: "Historical & deceased artists",
    heroDescription:
      "Catalogue of historical and deceased artists with works appearing in LAX.BID auctions.",
    filter: { historical: true },
  },
  {
    id: "kind-artists",
    canonicalPath: "/artists/kind/artists",
    label: "Artists",
    heroTitle: "Artists",
    heroDescription:
      "Named human creators — painters, sculptors, photographers — with works in the LAX.BID catalogue.",
    filter: { kinds: ["artist"] },
  },
  {
    id: "kind-makers",
    canonicalPath: "/artists/kind/makers",
    label: "Makers & studios",
    heroTitle: "Makers & studios",
    heroDescription:
      "Craftspeople, ateliers, and studios — furniture, ceramics, watchmaking and more — in the LAX.BID catalogue.",
    filter: { kinds: ["maker"] },
  },
  {
    id: "kind-brands",
    canonicalPath: "/artists/kind/brands",
    label: "Brands",
    heroTitle: "Brands",
    heroDescription:
      "Commercial brands and houses (Hermès, Cartier, etc.) represented across LAX.BID auctions.",
    filter: { kinds: ["brand"] },
  },
  {
    id: "kind-marques",
    canonicalPath: "/artists/kind/marques",
    label: "Marques",
    heroTitle: "Marques",
    heroDescription:
      "Vehicle and luxury-goods marques — Ferrari, Patek Philippe, and others — represented in LAX.BID auctions.",
    filter: { kinds: ["marque"] },
  },
];

/** Ids backed by `ARTIST_DIRECTORY_PRESETS` (excludes dynamic letter/decade/nationality slices). */
export type BuiltinArtistDirectoryPresetId = (typeof ARTIST_DIRECTORY_PRESETS)[number]["id"];

/** Resolve a built-in directory preset by id; throws if misconfigured. */
export function artistDirectoryPresetById(
  id: BuiltinArtistDirectoryPresetId,
): ArtistDirectoryPreset {
  const found = ARTIST_DIRECTORY_PRESETS.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Missing artist directory preset for id "${id}"`);
  }
  return found;
}

/**
 * Stable, pluralised URL slug per kind. The four original kinds keep their
 * historical slugs (no SEO regression); every other kind derives a clean slug
 * from the registry. Adding a kind only needs an entry here when the default
 * `${kind}s` pluralisation is wrong (OCP-friendly: most kinds need nothing).
 */
const KIND_SLUG_OVERRIDES: Partial<Record<ArtistKind, string>> = {
  artist: "artists",
  maker: "makers",
  brand: "brands",
  marque: "marques",
  studio: "studios",
  issuing_authority: "issuing-authorities",
};

/** Resolve the canonical directory slug for a kind. */
export function kindDirectorySlug(kind: ArtistKind): string {
  return KIND_SLUG_OVERRIDES[kind] ?? `${kind.replace(/_/g, "-")}s`;
}

/** Reverse lookup: a directory slug (or singular kind) back to its kind. */
export function kindFromDirectorySlug(slug: string): ArtistKind | null {
  const norm = slug.trim().toLowerCase();
  for (const kind of artistKinds) {
    if (kindDirectorySlug(kind) === norm) return kind;
    if (kind.replace(/_/g, "-") === norm) return kind;
  }
  return null;
}

/** Build a kind-locked directory preset from the registry (OCP — no per-kind
 * JSX or route edits needed for new kinds). */
export function kindPreset(kind: ArtistKind): ArtistDirectoryPreset {
  const config = getCreatorKindConfig(kind);
  const slug = kindDirectorySlug(kind);
  const departments = config.departmentHints.slice(0, 3).join(", ");
  return {
    id: `kind-${slug}` as ArtistDirectoryPresetId,
    canonicalPath: `/artists/kind/${slug}`,
    label: config.pluralLabel,
    heroTitle: config.pluralLabel,
    heroDescription: `Browse ${config.pluralLabel.toLowerCase()}${
      departments ? ` across ${departments}` : ""
    } with works appearing in LAX.BID auctions.`,
    filter: { kinds: [kind] },
  };
}

/** Map a `kind` URL slug to its preset (paths are pluralised in the URL). The
 * four original kinds keep their curated copy; all other kinds resolve to a
 * registry-derived preset so every taxonomy value has a landing page. */
export function presetForKindSlug(kindSlug: string): ArtistDirectoryPreset | null {
  const k = kindSlug.toLowerCase();
  const curated: Record<string, ArtistDirectoryPresetId> = {
    artists: "kind-artists",
    artist: "kind-artists",
    makers: "kind-makers",
    maker: "kind-makers",
    brands: "kind-brands",
    brand: "kind-brands",
    marques: "kind-marques",
    marque: "kind-marques",
  };
  const curatedId = curated[k];
  if (curatedId) {
    return ARTIST_DIRECTORY_PRESETS.find((p) => p.id === curatedId) ?? null;
  }
  const kind = kindFromDirectorySlug(k);
  return kind ? kindPreset(kind) : null;
}

/** A letter-slice preset built dynamically from a single character or `other`. */
export function letterPreset(letter: string): ArtistDirectoryPreset {
  const lower = letter.trim().toLowerCase();
  const display = lower === "other" ? "non-alphanumeric names" : `“${lower.toUpperCase()}”`;
  return {
    id: "letter",
    canonicalPath: `/artists/letter/${lower === "other" ? "other" : lower}`,
    label: lower === "other" ? "•" : lower.toUpperCase(),
    heroTitle:
      lower === "other" ? "Names beginning with a symbol" : `Artists starting with ${display}`,
    heroDescription: `Browse approved artists, makers, and brands whose name starts with ${display} on LAX.BID.`,
    filter: { letter: lower },
  };
}

/** Every kind's directory slug — drives `generateStaticParams` + the sitemap so
 * all taxonomy values get a crawlable landing page (OCP — derived from the
 * registry, no manual upkeep when a kind is added). */
export const KIND_SEGMENTS: readonly string[] = artistKinds.map(kindDirectorySlug);
export type KindSegment = string;

/** Static list of decade segments we pre-render. `pre-1800` covers everything
 * before 1800; the rest are decadal buckets up through the current decade. */
export const DECADE_SEGMENTS: ReadonlyArray<string> = [
  "pre-1800",
  "1800s",
  "1810s",
  "1820s",
  "1830s",
  "1840s",
  "1850s",
  "1860s",
  "1870s",
  "1880s",
  "1890s",
  "1900s",
  "1910s",
  "1920s",
  "1930s",
  "1940s",
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
];

/** Validate + normalize a decade segment slug. Returns the slug or `null`. */
export function normalizeDecadeSegment(slug: string): string | null {
  const norm = slug.trim().toLowerCase();
  if (norm === "pre-1800") return norm;
  return /^\d{4}s$/.test(norm) ? norm : null;
}

/** Build a decade-locked preset with crawlable copy and a canonical path. */
export function decadePreset(slug: string): ArtistDirectoryPreset | null {
  const decade = normalizeDecadeSegment(slug);
  if (!decade) return null;
  const label = decade === "pre-1800" ? "Before 1800" : decade;
  return {
    id: "decade",
    canonicalPath: `/artists/decade/${decade}`,
    label,
    heroTitle: decade === "pre-1800" ? "Artists born before 1800" : `Artists born in the ${decade}`,
    heroDescription:
      decade === "pre-1800"
        ? "Browse historical artists, makers, and brands born before 1800 with works appearing in LAX.BID auctions."
        : `Browse artists, makers, and brands born in the ${decade} with works in the LAX.BID catalogue.`,
    filter: { decade },
  };
}

/** Common nationalities we pre-render as canonical path-segment routes.
 * These drive `generateStaticParams` and sitemap generation. The list
 * covers major art-market nationalities; others work via query-param. */
export const NATIONALITY_SEGMENTS: ReadonlyArray<{
  slug: string;
  label: string;
}> = [
  { slug: "american", label: "American" },
  { slug: "british", label: "British" },
  { slug: "french", label: "French" },
  { slug: "german", label: "German" },
  { slug: "italian", label: "Italian" },
  { slug: "spanish", label: "Spanish" },
  { slug: "dutch", label: "Dutch" },
  { slug: "belgian", label: "Belgian" },
  { slug: "swiss", label: "Swiss" },
  { slug: "austrian", label: "Austrian" },
  { slug: "japanese", label: "Japanese" },
  { slug: "chinese", label: "Chinese" },
  { slug: "korean", label: "Korean" },
  { slug: "australian", label: "Australian" },
  { slug: "canadian", label: "Canadian" },
  { slug: "mexican", label: "Mexican" },
  { slug: "brazilian", label: "Brazilian" },
  { slug: "argentinian", label: "Argentinian" },
  { slug: "russian", label: "Russian" },
  { slug: "polish", label: "Polish" },
  { slug: "danish", label: "Danish" },
  { slug: "swedish", label: "Swedish" },
  { slug: "norwegian", label: "Norwegian" },
  { slug: "finnish", label: "Finnish" },
  { slug: "indian", label: "Indian" },
  { slug: "south-african", label: "South African" },
  { slug: "irish", label: "Irish" },
  { slug: "scottish", label: "Scottish" },
  { slug: "portuguese", label: "Portuguese" },
  { slug: "greek", label: "Greek" },
];

/** Convert a nationality slug (URL-safe) to its display label.
 * Returns `null` if the slug is not in our canonical list. */
export function nationalityFromSlug(slug: string): string | null {
  const norm = slug.trim().toLowerCase();
  const found = NATIONALITY_SEGMENTS.find((n) => n.slug === norm);
  return found?.label ?? null;
}

/** Convert a nationality display label to its URL slug.
 * Falls back to a simple kebab-case conversion for unlisted nationalities. */
export function slugifyNationality(label: string): string {
  const trimmed = label.trim();
  const found = NATIONALITY_SEGMENTS.find((n) => n.label.toLowerCase() === trimmed.toLowerCase());
  if (found) return found.slug;
  return slugifyRecordKey(trimmed);
}

/** Build a nationality-locked preset with crawlable copy and a canonical path. */
export function nationalityPreset(slug: string): ArtistDirectoryPreset | null {
  const label = nationalityFromSlug(slug);
  if (!label) return null;
  return {
    id: "nationality",
    canonicalPath: `/artists/nationality/${slug}`,
    label,
    heroTitle: `${label} artists`,
    heroDescription: `Browse ${label} artists, makers, and brands with works appearing in LAX.BID auctions.`,
    filter: { nationality: label },
  };
}
