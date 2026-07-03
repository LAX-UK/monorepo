import { artistCategories, artistProfile, category } from "@auction/db/schema";
import type { ArtistKind } from "@auction/types";
import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { AdminArtistListOptions } from "../../interfaces/artist-profile-admin.reader.js";
import {
  artistHasPublicBrowseLotsExists,
  artistPublicCatalogLotCountSubquery,
} from "../artist-public-lot-count.sql.js";

/** Correlated lot counts for SELECT lists. Drizzle strips table qualifiers inside
 * `sql` selected fields (see drizzle-orm#5734), so correlate with bare SQL
 * table names that match the outer `artist_profile` row.
 *
 * Admin list: all non-deleted lots with FK attribution to the artist.
 * Public directory card counts: public catalogue lots (scheduled + active + ended). */
export const lotCountExpr = sql<number>`(
  select count(*)::int
  from lot
  where lot.artist_id = artist_profile.id
    and lot.deleted_at is null
)`;
export const publicLotCountExpr = artistPublicCatalogLotCountSubquery();
export const aliasCountExpr = sql<number>`(
  select count(*)::int
  from artist_alias
  where artist_alias.artist_profile_id = artist_profile.id
)`;

/** Extract the leading 4-digit year from `birth_year` text using a Postgres regex.
 * Returns `NULL` when no year prefix is present. Reused by decade filter + facets. */
export const birthYearExpr = sql<number | null>`case
  when substring(coalesce(${artistProfile.birthYear}, '') from '^\\d{4}') ~ '^\\d{4}$'
  then substring(${artistProfile.birthYear} from '^\\d{4}')::int
  else null
end`;

/** Build a `where` clause that filters artists into a decade slug. Returns `null`
 * when the slug isn't recognised so callers can skip filter merge. */
export function decadeWhereClause(slug: string | undefined) {
  if (!slug) return null;
  const norm = slug.trim().toLowerCase();
  if (norm === "pre-1800") {
    return sql`${birthYearExpr} is not null and ${birthYearExpr} < 1800`;
  }
  const m = /^(\d{4})s$/.exec(norm);
  if (!m || !m[1]) return null;
  const start = Number.parseInt(m[1], 10);
  if (!Number.isFinite(start)) return null;
  return sql`${birthYearExpr} is not null and ${birthYearExpr} >= ${start} and ${birthYearExpr} < ${start + 10}`;
}

export function buildAdminListFilters(options: AdminArtistListOptions) {
  const filters = [];
  if (options.archivedOnly) {
    filters.push(eq(artistProfile.archived, true));
  } else if (!options.includeArchived) {
    filters.push(eq(artistProfile.archived, false));
  }

  if (options.q?.trim()) {
    const q = `%${options.q.trim().replace(/[%_\\]/g, "")}%`;
    filters.push(
      sql`(${artistProfile.displayName} ilike ${q} or ${artistProfile.slug} ilike ${q})`,
    );
  }

  if (options.kinds && options.kinds.length > 0) {
    filters.push(inArray(artistProfile.kind, options.kinds));
  } else if (options.kind) {
    filters.push(eq(artistProfile.kind, options.kind));
  }

  if (options.status) filters.push(eq(artistProfile.status, options.status));
  if (options.ownerUserId?.trim()) {
    filters.push(eq(artistProfile.ownerUserId, options.ownerUserId.trim()));
  }
  if (options.country?.trim()) {
    filters.push(eq(artistProfile.countryCode, options.country.trim().toUpperCase()));
  }
  if (options.categoryId) {
    filters.push(
      sql`exists (select 1 from ${artistCategories} where ${artistCategories.artistProfileId} = ${artistProfile.id} and ${artistCategories.categoryId} = ${options.categoryId})`,
    );
  }
  if (options.featured === true) filters.push(eq(artistProfile.featured, true));
  if (options.verified === true) filters.push(eq(artistProfile.verified, true));
  const linked = options.linked ?? "any";
  if (linked === "yes") filters.push(isNotNull(artistProfile.ownerUserId));
  if (linked === "no") filters.push(isNull(artistProfile.ownerUserId));

  return filters.length > 0 ? (filters.length === 1 ? filters[0] : and(...filters)) : undefined;
}

export function orderByClause(sort: AdminArtistListOptions["sort"]) {
  const s = sort ?? "name_asc";
  switch (s) {
    case "name_desc":
      return [desc(artistProfile.displayName)];
    case "updated_desc":
      return [desc(artistProfile.updatedAt)];
    case "updated_asc":
      return [asc(artistProfile.updatedAt)];
    case "lots_desc":
      return [desc(lotCountExpr), asc(artistProfile.displayName)];
    case "lots_asc":
      return [asc(lotCountExpr), asc(artistProfile.displayName)];
    case "status_asc":
      return [asc(artistProfile.status), asc(artistProfile.displayName)];
    case "status_desc":
      return [desc(artistProfile.status), asc(artistProfile.displayName)];
    default:
      return [asc(artistProfile.displayName)];
  }
}

export type PublicDirectoryListOptions = {
  q?: string;
  kind?: ArtistKind;
  kinds?: ArtistKind[];
  letter?: string;
  living?: boolean;
  historical?: boolean;
  nationality?: string;
  country?: string;
  categorySlug?: string;
  featuredOnly?: boolean;
  featuredFirst?: boolean;
  decade?: string;
  hasUpcoming?: boolean;
  sort?: "name_asc" | "popular" | "recent";
};

export function buildPublicDirectoryWhere(options: PublicDirectoryListOptions) {
  const baseFilters = [eq(artistProfile.archived, false), eq(artistProfile.status, "approved")];
  if (options.q?.trim()) {
    const q = `%${options.q.trim().replace(/[%_\\]/g, "")}%`;
    baseFilters.push(
      sql`(${artistProfile.displayName} ilike ${q} or ${artistProfile.slug} ilike ${q})`,
    );
  }

  const refinedFilters = [...baseFilters];
  if (options.featuredOnly === true) refinedFilters.push(eq(artistProfile.featured, true));
  if (options.kinds && options.kinds.length > 0) {
    refinedFilters.push(inArray(artistProfile.kind, options.kinds));
  } else if (options.kind) {
    refinedFilters.push(eq(artistProfile.kind, options.kind));
  }
  if (options.living === true) refinedFilters.push(isNull(artistProfile.deathYear));
  if (options.historical === true) refinedFilters.push(isNotNull(artistProfile.deathYear));
  if (options.nationality?.trim()) {
    refinedFilters.push(ilike(artistProfile.nationality, `%${options.nationality.trim()}%`));
  }
  if (options.country?.trim()) {
    refinedFilters.push(eq(artistProfile.countryCode, options.country.trim().toUpperCase()));
  }
  if (options.categorySlug?.trim()) {
    refinedFilters.push(
      sql`exists (select 1 from ${artistCategories} inner join ${category} on ${category.id} = ${artistCategories.categoryId} where ${artistCategories.artistProfileId} = ${artistProfile.id} and ${category.slug} = ${options.categorySlug.trim()})`,
    );
  }
  const decadeFilter = decadeWhereClause(options.decade);
  if (decadeFilter) refinedFilters.push(decadeFilter);
  if (options.hasUpcoming === true) {
    refinedFilters.push(artistHasPublicBrowseLotsExists());
  }
  const letter = options.letter?.trim().toLowerCase();
  if (letter === "other") {
    refinedFilters.push(sql`lower(left(trim(${artistProfile.displayName}), 1)) !~ '^[a-z0-9]'`);
  } else if (letter && letter.length === 1) {
    if (letter >= "0" && letter <= "9") {
      refinedFilters.push(sql`left(trim(${artistProfile.displayName}), 1) = ${letter}`);
    } else if (letter >= "a" && letter <= "z") {
      refinedFilters.push(sql`lower(left(trim(${artistProfile.displayName}), 1)) = ${letter}`);
    }
  }

  return {
    whereClause: and(...refinedFilters),
    baseWhere: and(...baseFilters),
  };
}

export function publicDirectoryOrderBy(options: PublicDirectoryListOptions) {
  const sort = options.sort ?? "name_asc";
  return options.featuredFirst === true
    ? [desc(artistProfile.featured), asc(artistProfile.displayName)]
    : sort === "recent"
      ? [desc(artistProfile.updatedAt), asc(artistProfile.displayName)]
      : sort === "popular"
        ? [desc(publicLotCountExpr), asc(artistProfile.displayName)]
        : [asc(artistProfile.displayName)];
}
