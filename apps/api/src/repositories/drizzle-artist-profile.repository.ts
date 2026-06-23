import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import {
  artistAlias,
  artistCategories,
  artistProfile,
  artistWatchlist,
  category,
  lot,
  user,
} from "@auction/db/schema";
import type {
  AdminArtistListResult,
  AdminArtistListRow,
  AdminArtistStats,
  ArtistCategoryRef,
  ArtistDeleteGuardCounts,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
  PublicArtistDirectoryFacets,
  PublicArtistDirectoryResult,
  PublicArtistDirectoryRow,
} from "@auction/types";
import {
  type adminCreateArtistBodySchema,
  type adminUpdateArtistBodySchema,
  parseCreatorAttributes,
} from "@auction/validators";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import type { AdminArtistListOptions } from "../admin/admin-route-dtos.js";
import { replaceArtistCategoriesInTx } from "../services/artist-registry.service.js";
import type { DbTransaction } from "../services/interfaces/artist-delete.js";
import {
  artistHasPublicBrowseLotsExists,
  artistPublicBrowseLotCountSubquery,
} from "./artist-public-lot-count.sql.js";

export type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema> & {
  slug: string;
  /** Set by admin route — which staff member created the profile */
  createdByUserId?: string | null;
};
export type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema> & {
  slug?: string | undefined;
};

function mapArtist(row: typeof artistProfile.$inferSelect): ArtistProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    slug: row.slug,
    portraitUrl: row.portraitUrl,
    heroImageUrl: row.heroImageUrl,
    shortBio: row.shortBio,
    longBio: row.longBio,
    statement: row.statement,
    nationality: row.nationality,
    location: row.location,
    countryCode: row.countryCode ?? null,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    foundedYear: row.foundedYear ?? null,
    dissolvedYear: row.dissolvedYear ?? null,
    websiteUrl: row.websiteUrl,
    socialLinks: row.socialLinks ?? {},
    attributes: row.attributes ?? {},
    featured: row.featured,
    verified: row.verified,
    archived: row.archived,
    kind: row.kind as ArtistKind,
    status: row.status as ArtistStatus,
    mergedIntoArtistId: row.mergedIntoArtistId ?? null,
    ownerUserId: row.ownerUserId,
    ownerLegalEntityId: row.ownerLegalEntityId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapAdminListRow(
  row: typeof artistProfile.$inferSelect,
  extras: {
    lotCount: number;
    aliasCount: number;
    ownerDisplayName: string | null;
    ownerImage: string | null;
  },
): AdminArtistListRow {
  return { ...mapArtist(row), ...extras };
}

function buildAdminListFilters(options: AdminArtistListOptions) {
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

/** Correlated lot counts for SELECT lists. Drizzle strips table qualifiers inside
 * `sql` selected fields (see drizzle-orm#5734), so correlate with bare SQL
 * table names that match the outer `artist_profile` row.
 *
 * Admin list: all non-deleted lots with FK attribution to the artist.
 * Public directory card counts: browseable lots only (active + scheduled on public sales). */
const lotCountExpr = sql<number>`(
  select count(*)::int
  from lot
  where lot.artist_id = artist_profile.id
    and lot.deleted_at is null
)`;
const publicLotCountExpr = artistPublicBrowseLotCountSubquery();
const aliasCountExpr = sql<number>`(
  select count(*)::int
  from artist_alias
  where artist_alias.artist_profile_id = artist_profile.id
)`;

/** Extract the leading 4-digit year from `birth_year` text using a Postgres regex.
 * Returns `NULL` when no year prefix is present. Reused by decade filter + facets. */
const birthYearExpr = sql<number | null>`case
  when substring(coalesce(${artistProfile.birthYear}, '') from '^\\d{4}') ~ '^\\d{4}$'
  then substring(${artistProfile.birthYear} from '^\\d{4}')::int
  else null
end`;

/** Build a `where` clause that filters artists into a decade slug. Returns `null`
 * when the slug isn't recognised so callers can skip filter merge. */
function decadeWhereClause(slug: string | undefined) {
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

function orderByClause(sort: AdminArtistListOptions["sort"]) {
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

export class DrizzleArtistProfileRepository {
  constructor(private readonly db: Database) {}

  /** Ordered category (department) refs for one artist. */
  private async loadCategories(artistProfileId: string): Promise<ArtistCategoryRef[]> {
    const rows = await this.db
      .select({ id: category.id, name: category.name, slug: category.slug })
      .from(artistCategories)
      .innerJoin(category, eq(category.id, artistCategories.categoryId))
      .where(eq(artistCategories.artistProfileId, artistProfileId))
      .orderBy(asc(artistCategories.sortOrder), asc(category.name));
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug }));
  }

  /** Batch category loader for list views (avoids N+1). */
  private async loadCategoriesForArtists(
    artistProfileIds: string[],
  ): Promise<Map<string, ArtistCategoryRef[]>> {
    const map = new Map<string, ArtistCategoryRef[]>();
    if (artistProfileIds.length === 0) return map;
    const rows = await this.db
      .select({
        artistProfileId: artistCategories.artistProfileId,
        id: category.id,
        name: category.name,
        slug: category.slug,
        sortOrder: artistCategories.sortOrder,
      })
      .from(artistCategories)
      .innerJoin(category, eq(category.id, artistCategories.categoryId))
      .where(inArray(artistCategories.artistProfileId, artistProfileIds))
      .orderBy(asc(artistCategories.sortOrder), asc(category.name));
    for (const row of rows) {
      const list = map.get(row.artistProfileId) ?? [];
      list.push({ id: row.id, name: row.name, slug: row.slug });
      map.set(row.artistProfileId, list);
    }
    return map;
  }

  async list(
    options: {
      includeArchived?: boolean;
      q?: string;
      kind?: ArtistKind;
      status?: ArtistStatus;
      ownerUserId?: string;
    } = {},
  ): Promise<ArtistProfile[]> {
    const filters = [];
    if (!options.includeArchived) filters.push(eq(artistProfile.archived, false));
    if (options.q?.trim()) {
      const q = `%${options.q.trim().replace(/[%_\\]/g, "")}%`;
      filters.push(
        sql`(${artistProfile.displayName} ilike ${q} or ${artistProfile.slug} ilike ${q})`,
      );
    }
    if (options.kind) filters.push(eq(artistProfile.kind, options.kind));
    if (options.status) filters.push(eq(artistProfile.status, options.status));
    if (options.ownerUserId?.trim()) {
      filters.push(eq(artistProfile.ownerUserId, options.ownerUserId.trim()));
    }
    const rows = await this.db
      .select()
      .from(artistProfile)
      .where(filters.length > 0 ? (filters.length === 1 ? filters[0] : and(...filters)) : undefined)
      .orderBy(asc(artistProfile.displayName));
    return rows.map(mapArtist);
  }

  /** Paginated admin list with lot/alias counts and linked owner display fields. */
  async listForAdmin(options: AdminArtistListOptions = {}): Promise<AdminArtistListResult> {
    const where = buildAdminListFilters(options);
    const limit = Math.min(200, Math.max(10, options.limit ?? 50));
    const offset = Math.max(0, options.offset ?? 0);

    const [countRow] = await this.db.select({ n: count() }).from(artistProfile).where(where);

    const total = Number(countRow?.n ?? 0);

    const rows = await this.db
      .select({
        ap: artistProfile,
        lotCount: lotCountExpr,
        aliasCount: aliasCountExpr,
        ownerDisplayName: user.name,
        ownerImage: user.image,
      })
      .from(artistProfile)
      .leftJoin(user, eq(artistProfile.ownerUserId, user.id))
      .where(where)
      .orderBy(...orderByClause(options.sort))
      .limit(limit)
      .offset(offset);

    const categoriesById = await this.loadCategoriesForArtists(rows.map((r) => r.ap.id));

    return {
      total,
      rows: rows.map((r) => ({
        ...mapAdminListRow(r.ap, {
          lotCount: Number(r.lotCount ?? 0),
          aliasCount: Number(r.aliasCount ?? 0),
          ownerDisplayName: r.ownerDisplayName ?? null,
          ownerImage: r.ownerImage ?? null,
        }),
        categories: categoriesById.get(r.ap.id) ?? [],
      })),
    };
  }

  /** Dashboard stats for admin artists hub + sidebar pending badge. */
  async adminArtistStats(): Promise<AdminArtistStats> {
    const base = and(eq(artistProfile.archived, false));

    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        pendingReview: sql<number>`count(*) filter (where ${artistProfile.status} = 'pending')::int`,
        makerSellers: sql<number>`count(*) filter (where ${artistProfile.ownerUserId} is not null)::int`,
        historical: sql<number>`count(*) filter (where ${artistProfile.ownerUserId} is null and ${artistProfile.kind} in ('artist','maker'))::int`,
        brands: sql<number>`count(*) filter (where ${artistProfile.kind} in ('brand','marque'))::int`,
        featured: sql<number>`count(*) filter (where ${artistProfile.featured})::int`,
      })
      .from(artistProfile)
      .where(base);

    return {
      total: Number(row?.total ?? 0),
      pendingReview: Number(row?.pendingReview ?? 0),
      makerSellers: Number(row?.makerSellers ?? 0),
      historical: Number(row?.historical ?? 0),
      brands: Number(row?.brands ?? 0),
      featured: Number(row?.featured ?? 0),
    };
  }

  async findById(id: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, id))
      .limit(1);
    if (!row) return null;
    return { ...mapArtist(row), categories: await this.loadCategories(id) };
  }

  /** Public marketing directory: approved, not archived, server-paged.
   *
   * Returns `{ rows, total, facets }`. The facets are computed against the
   * "base filter" — search/letter/q only — so chip counts reflect what would
   * happen if the user toggled a single facet. (Chip counts that included
   * the facet itself would always equal the current total, which is useless.) */
  async listPublicDirectory(options: {
    limit: number;
    offset: number;
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
  }): Promise<PublicArtistDirectoryResult> {
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

    const whereClause = and(...refinedFilters);
    const baseWhere = and(...baseFilters);

    const [countRow] = await this.db.select({ n: count() }).from(artistProfile).where(whereClause);
    const total = Number(countRow?.n ?? 0);

    const sort = options.sort ?? "name_asc";
    const orderBy =
      options.featuredFirst === true
        ? [desc(artistProfile.featured), asc(artistProfile.displayName)]
        : sort === "recent"
          ? [desc(artistProfile.updatedAt), asc(artistProfile.displayName)]
          : sort === "popular"
            ? [desc(publicLotCountExpr), asc(artistProfile.displayName)]
            : [asc(artistProfile.displayName)];

    const rows = await this.db
      .select({ ap: artistProfile, lotCount: publicLotCountExpr })
      .from(artistProfile)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(options.limit)
      .offset(options.offset);

    const facets = await this.computeDirectoryFacets(baseWhere);

    const mapped: PublicArtistDirectoryRow[] = rows.map((r) => ({
      ...mapArtist(r.ap),
      lotCount: Number(r.lotCount ?? 0),
    }));
    return { total, rows: mapped, facets };
  }

  /** Facet aggregates for the public directory — letters / kinds / living-historical / featured / nationalities.
   * Computed against the *base* filter (q + approved + non-archived) so each
   * facet count is independent of the current refinement (else chip counts
   * always equal the current total, which is useless for navigation). */
  private async computeDirectoryFacets(
    baseWhere: ReturnType<typeof and>,
  ): Promise<PublicArtistDirectoryFacets> {
    const [agg] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        featured: sql<number>`count(*) filter (where ${artistProfile.featured})::int`,
        living: sql<number>`count(*) filter (where ${artistProfile.deathYear} is null)::int`,
        historical: sql<number>`count(*) filter (where ${artistProfile.deathYear} is not null)::int`,
        hasUpcoming: sql<number>`count(*) filter (where ${artistHasPublicBrowseLotsExists()})::int`,
      })
      .from(artistProfile)
      .where(baseWhere);

    // Kind counts grouped dynamically so new kinds appear without code changes (OCP).
    const kindRows = await this.db
      .select({ kind: artistProfile.kind, n: sql<number>`count(*)::int` })
      .from(artistProfile)
      .where(baseWhere)
      .groupBy(artistProfile.kind);
    const byKind: Partial<Record<ArtistKind, number>> = {};
    for (const row of kindRows) {
      byKind[row.kind as ArtistKind] = Number(row.n ?? 0);
    }

    // Top collecting categories (departments) for the directory side rail.
    const categoryFacetRows = await this.db
      .select({
        id: category.id,
        name: category.name,
        slug: category.slug,
        n: sql<number>`count(*)::int`,
      })
      .from(artistCategories)
      .innerJoin(category, eq(category.id, artistCategories.categoryId))
      .innerJoin(artistProfile, eq(artistProfile.id, artistCategories.artistProfileId))
      .where(and(baseWhere, eq(category.archived, false)))
      .groupBy(category.id, category.name, category.slug)
      .orderBy(sql`count(*) desc`)
      .limit(12);
    const topCategories = categoryFacetRows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      count: Number(r.n ?? 0),
    }));

    const letterBucketExpr = sql<string>`case
      when lower(left(trim(${artistProfile.displayName}), 1)) ~ '^[a-z]' then lower(left(trim(${artistProfile.displayName}), 1))
      when lower(left(trim(${artistProfile.displayName}), 1)) ~ '^[0-9]' then '#'
      else 'other'
    end`;

    const letterRows = await this.db
      .select({
        bucket: letterBucketExpr,
        n: sql<number>`count(*)::int`,
      })
      .from(artistProfile)
      .where(baseWhere)
      .groupBy(letterBucketExpr);

    const letters = letterRows.map((r) => ({
      letter: String(r.bucket),
      count: Number(r.n ?? 0),
    }));

    const nationalityRows = await this.db
      .select({
        nationality: artistProfile.nationality,
        n: sql<number>`count(*)::int`,
      })
      .from(artistProfile)
      .where(and(baseWhere, isNotNull(artistProfile.nationality)))
      .groupBy(artistProfile.nationality)
      .orderBy(sql`count(*) desc`)
      .limit(12);

    const topNationalities = nationalityRows
      .map((r) => ({
        value: (r.nationality ?? "").trim(),
        count: Number(r.n ?? 0),
      }))
      .filter((r) => r.value.length > 0);

    /** Decades grouped on the floor of birthYear / 10, with a single "pre-1800"
     * bucket so the rail doesn't sprawl. We return the top 8 by count so the
     * UI stays compact. */
    const decadeBucketExpr = sql<string>`case
      when ${birthYearExpr} is null then null
      when ${birthYearExpr} < 1800 then 'pre-1800'
      else (floor(${birthYearExpr} / 10) * 10)::int::text || 's'
    end`;

    const decadeRows = await this.db
      .select({
        bucket: decadeBucketExpr,
        n: sql<number>`count(*)::int`,
      })
      .from(artistProfile)
      .where(and(baseWhere, isNotNull(artistProfile.birthYear)))
      .groupBy(decadeBucketExpr)
      .orderBy(decadeBucketExpr);

    const topDecades = decadeRows
      .map((r) => {
        const key = String(r.bucket ?? "").trim();
        if (!key) return null;
        const label = key === "pre-1800" ? "Before 1800" : key;
        return { key, label, count: Number(r.n ?? 0) };
      })
      .filter((r): r is { key: string; label: string; count: number } => r !== null);

    return {
      total: Number(agg?.total ?? 0),
      featured: Number(agg?.featured ?? 0),
      living: Number(agg?.living ?? 0),
      historical: Number(agg?.historical ?? 0),
      byKind,
      hasUpcoming: Number(agg?.hasUpcoming ?? 0),
      topNationalities,
      topCategories,
      topDecades,
      letters,
    };
  }

  /** Aliases for a single artist, sorted by alias text — used by public profile chips. */
  async findAliasesByArtistId(artistId: string): Promise<string[]> {
    const rows = await this.db
      .select({ alias: artistAlias.alias })
      .from(artistAlias)
      .where(eq(artistAlias.artistProfileId, artistId))
      .orderBy(asc(artistAlias.alias));
    return rows
      .map((r) => r.alias)
      .filter((a): a is string => typeof a === "string" && a.length > 0);
  }

  async findBySlug(slug: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    if (!row) return null;
    return { ...mapArtist(row), categories: await this.loadCategories(row.id) };
  }

  async create(input: CreateArtistInput): Promise<ArtistProfile> {
    const kind = input.kind ?? "artist";
    const [row] = await this.db
      .insert(artistProfile)
      .values({
        displayName: input.displayName,
        slug: input.slug,
        kind,
        status: input.status ?? "approved",
        portraitUrl: input.portraitUrl ?? null,
        heroImageUrl: input.heroImageUrl ?? null,
        shortBio: input.shortBio ?? null,
        longBio: input.longBio ?? null,
        statement: input.statement ?? null,
        nationality: input.nationality ?? null,
        location: input.location ?? null,
        countryCode: input.countryCode ?? null,
        birthYear: input.birthYear ?? null,
        deathYear: input.deathYear ?? null,
        foundedYear: input.foundedYear ?? null,
        dissolvedYear: input.dissolvedYear ?? null,
        attributes: parseCreatorAttributes(kind, input.attributes),
        websiteUrl: input.websiteUrl ?? null,
        ownerUserId: input.ownerUserId ?? null,
        createdByUserId: input.createdByUserId ?? null,
        featured: input.featured ?? false,
        verified: input.verified ?? false,
        archived: input.archived ?? false,
      })
      .returning();
    if (!row) throw new Error("Artist create failed");
    if (input.categoryIds && input.categoryIds.length > 0) {
      await replaceArtistCategoriesInTx(this.db, row.id, input.categoryIds);
    }
    return { ...mapArtist(row), categories: await this.loadCategories(row.id) };
  }

  async update(id: string, input: UpdateArtistInput): Promise<ArtistProfile | null> {
    // Attributes are validated/cleaned against the *effective* kind (the patch
    // kind, or the current row's kind when the patch leaves kind untouched).
    let attributesSet: Record<string, string> | undefined;
    if (input.attributes !== undefined) {
      let effectiveKind = input.kind;
      if (!effectiveKind) {
        const [current] = await this.db
          .select({ kind: artistProfile.kind })
          .from(artistProfile)
          .where(eq(artistProfile.id, id))
          .limit(1);
        effectiveKind = (current?.kind as ArtistKind | undefined) ?? "artist";
      }
      attributesSet = parseCreatorAttributes(effectiveKind, input.attributes);
    }

    const [row] = await this.db
      .update(artistProfile)
      .set({
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.portraitUrl !== undefined ? { portraitUrl: input.portraitUrl ?? null } : {}),
        ...(input.heroImageUrl !== undefined ? { heroImageUrl: input.heroImageUrl ?? null } : {}),
        ...(input.shortBio !== undefined ? { shortBio: input.shortBio ?? null } : {}),
        ...(input.longBio !== undefined ? { longBio: input.longBio ?? null } : {}),
        ...(input.statement !== undefined ? { statement: input.statement ?? null } : {}),
        ...(input.nationality !== undefined ? { nationality: input.nationality ?? null } : {}),
        ...(input.location !== undefined ? { location: input.location ?? null } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode ?? null } : {}),
        ...(input.birthYear !== undefined ? { birthYear: input.birthYear ?? null } : {}),
        ...(input.deathYear !== undefined ? { deathYear: input.deathYear ?? null } : {}),
        ...(input.foundedYear !== undefined ? { foundedYear: input.foundedYear ?? null } : {}),
        ...(input.dissolvedYear !== undefined
          ? { dissolvedYear: input.dissolvedYear ?? null }
          : {}),
        ...(attributesSet !== undefined ? { attributes: attributesSet } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId ?? null } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.verified !== undefined ? { verified: input.verified } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
        updatedAt: new Date(),
      })
      .where(eq(artistProfile.id, id))
      .returning();
    if (!row) return null;
    if (input.categoryIds !== undefined) {
      await replaceArtistCategoriesInTx(this.db, id, input.categoryIds);
    }
    return { ...mapArtist(row), categories: await this.loadCategories(id) };
  }

  /** Count of `lot` rows currently attached to a given artist via FK. Used by
   * the admin artist list to surface "N lots" badges. */
  async countLotsByArtist(artistId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(lot)
      .where(and(eq(lot.artistId, artistId), lotNotDeleted()));
    return Number(row?.value ?? 0);
  }

  async countDeleteGuards(artistId: string, tx?: DbTransaction): Promise<ArtistDeleteGuardCounts> {
    const conn = tx ?? this.db;
    const [lotRow, mergeRow, watchlistRow] = await Promise.all([
      conn
        .select({ value: count() })
        .from(lot)
        .where(eq(lot.artistId, artistId))
        .then((rows) => rows[0]),
      conn
        .select({ value: count() })
        .from(artistProfile)
        .where(
          and(
            eq(artistProfile.mergedIntoArtistId, artistId),
            eq(artistProfile.status, "merged_into"),
          ),
        )
        .then((rows) => rows[0]),
      conn
        .select({ value: count() })
        .from(artistWatchlist)
        .where(eq(artistWatchlist.artistId, artistId))
        .then((rows) => rows[0]),
    ]);

    return {
      lotCount: Number(lotRow?.value ?? 0),
      mergeDependentCount: Number(mergeRow?.value ?? 0),
      watchlistCount: Number(watchlistRow?.value ?? 0),
    };
  }

  async findByIdForUpdate(id: string, tx: DbTransaction): Promise<ArtistProfile | null> {
    const [row] = await tx
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, id))
      .for("update")
      .limit(1);
    return row ? mapArtist(row) : null;
  }

  async deleteById(id: string, tx: DbTransaction): Promise<boolean> {
    const deleted = await tx
      .delete(artistProfile)
      .where(eq(artistProfile.id, id))
      .returning({ id: artistProfile.id });
    return deleted.length > 0;
  }
}
