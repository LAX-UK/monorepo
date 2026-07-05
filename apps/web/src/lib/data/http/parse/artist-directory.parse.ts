import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import type {
  ArtistKind,
  PublicArtistDecadeFacet,
  PublicArtistDirectoryFacets,
  PublicArtistDirectoryRow,
  PublicArtistLetterFacet,
} from "@auction/types";
import { artistKinds } from "@auction/types";
import { parseArtistProfile } from "./artist-profile.parse";

function parseByKind(raw: unknown): PublicArtistDirectoryFacets["byKind"] {
  if (!isIndexableObject(raw)) return {};
  const out: PublicArtistDirectoryFacets["byKind"] = {};
  for (const [key, value] of Object.entries(raw)) {
    if ((artistKinds as readonly string[]).includes(key)) {
      out[key as ArtistKind] = Number(value ?? 0);
    }
  }
  return out;
}

function parseTopNationalities(raw: unknown): PublicArtistDirectoryFacets["topNationalities"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = toObjectRecord(entry);
      return { value: String(row.value ?? ""), count: Number(row.count ?? 0) };
    })
    .filter((item) => item.value.length > 0);
}

function parseTopCategories(raw: unknown): PublicArtistDirectoryFacets["topCategories"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = toObjectRecord(entry);
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        slug: String(row.slug ?? ""),
        count: Number(row.count ?? 0),
      };
    })
    .filter((item) => item.id.length > 0);
}

function parseTopDecades(raw: unknown): PublicArtistDecadeFacet[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const row = toObjectRecord(entry);
      return {
        key: String(row.key ?? ""),
        label: String(row.label ?? ""),
        count: Number(row.count ?? 0),
      };
    })
    .filter((item) => item.key.length > 0);
}

function parseLetters(raw: unknown): PublicArtistLetterFacet[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const row = toObjectRecord(entry);
    return { letter: String(row.letter ?? ""), count: Number(row.count ?? 0) };
  });
}

export function emptyPublicArtistDirectoryFacets(): PublicArtistDirectoryFacets {
  return {
    total: 0,
    featured: 0,
    living: 0,
    historical: 0,
    byKind: {},
    hasUpcoming: 0,
    topNationalities: [],
    topCategories: [],
    topDecades: [],
    letters: [],
  };
}

/** Row parser for public artist directory facet aggregates. */
export function parsePublicArtistDirectoryFacets(raw: unknown): PublicArtistDirectoryFacets {
  if (!isIndexableObject(raw)) return emptyPublicArtistDirectoryFacets();
  return {
    total: Number(raw.total ?? 0),
    featured: Number(raw.featured ?? 0),
    living: Number(raw.living ?? 0),
    historical: Number(raw.historical ?? 0),
    byKind: parseByKind(raw.byKind),
    hasUpcoming: Number(raw.hasUpcoming ?? 0),
    topNationalities: parseTopNationalities(raw.topNationalities),
    topCategories: parseTopCategories(raw.topCategories),
    topDecades: parseTopDecades(raw.topDecades),
    letters: parseLetters(raw.letters),
  };
}

/** Row parser for public artist directory cards (`ArtistProfile` + `lotCount`). */
export function parsePublicArtistDirectoryRow(raw: unknown): PublicArtistDirectoryRow {
  const row = toObjectRecord(raw);
  return {
    ...parseArtistProfile(row),
    lotCount: Number(row.lotCount ?? 0),
  };
}
