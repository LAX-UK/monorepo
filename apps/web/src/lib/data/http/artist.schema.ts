import type { ArtistProfile } from "@/lib/data/contracts";
import { toObjectRecord } from "@/lib/data/http/object-guards";
import {
  emptyPublicArtistDirectoryFacets,
  parsePublicArtistDirectoryFacets,
  parsePublicArtistDirectoryRow,
} from "@/lib/data/http/parse/artist-directory.parse";
import { parseArtistProfile } from "@/lib/data/http/parse/artist-profile.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";
import type { PublicArtistDirectoryFacets, PublicArtistDirectoryResult } from "@auction/types";
import { z } from "zod";

export type PublicArtistBrowseParams = {
  limit?: number;
  offset?: number;
  q?: string;
  letter?: string;
  kind?: string;
  kinds?: string;
  living?: boolean;
  historical?: boolean;
  nationality?: string;
  /** ISO 3166-1 alpha-2 origin country code. */
  country?: string;
  /** Collecting category (department) slug, e.g. `motor-cars`. */
  categorySlug?: string;
  featuredOnly?: boolean;
  featuredFirst?: boolean;
  /** Decade slug (e.g. `1900s`, `pre-1800`) — filters by `birth_year`. */
  decade?: string;
  /** When true, only artists with at least one `active`/`scheduled` lot. */
  hasUpcoming?: boolean;
  sort?: "name_asc" | "popular" | "recent";
};

export type SitemapArtist = { id: string; name: string };

export function emptyFacets(): PublicArtistDirectoryFacets {
  return emptyPublicArtistDirectoryFacets();
}

export const registryArtistProfileSchema = zTransformParse(parseArtistProfile);

export const publicArtistAliasesSchema = z.array(z.string()) as z.ZodType<string[]>;

const registryPublicRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row) => ({
    id: String(row.id ?? ""),
    displayName: String(row.displayName ?? ""),
    shortBio: row.shortBio == null ? null : String(row.shortBio),
    portraitUrl: row.portraitUrl == null ? null : String(row.portraitUrl),
    nationality: row.nationality == null ? null : String(row.nationality),
  }));

export function portraitForPublicArtist(image: string | null | undefined): string | null {
  const trimmed = image?.trim();
  return trimmed || null;
}

export function mapRegistryRowToArtist(row: {
  id: string;
  displayName: string;
  shortBio?: string | null;
  portraitUrl?: string | null;
  nationality?: string | null;
}): ArtistProfile {
  return {
    id: row.id,
    name: row.displayName,
    tagline: row.nationality?.trim() || "Catalogue artist",
    bio: row.shortBio ?? "",
    portraitUrl: portraitForPublicArtist(row.portraitUrl ?? null),
    stats: [],
  };
}

export const registryPublicArtistRowSchema = registryPublicRowSchema.transform(
  mapRegistryRowToArtist,
) as z.ZodType<ArtistProfile>;

export const sitemapArtistRowSchema = registryPublicRowSchema.transform(
  (row): SitemapArtist | null => {
    if (!row.id || !row.displayName) return null;
    return { id: row.id, name: row.displayName };
  },
) as z.ZodType<SitemapArtist | null>;

const publicArtistDirectoryFacetsSchema = zTransformParse(parsePublicArtistDirectoryFacets);

export const publicArtistBrowseResultSchema = z
  .object({
    rows: z.array(zTransformParse(parsePublicArtistDirectoryRow)).optional(),
    total: z.coerce.number().optional(),
    facets: publicArtistDirectoryFacetsSchema.optional(),
  })
  .transform(
    (data): PublicArtistDirectoryResult => ({
      rows: data.rows ?? [],
      total: data.total ?? 0,
      facets: data.facets ?? emptyFacets(),
    }),
  ) as z.ZodType<PublicArtistDirectoryResult>;
