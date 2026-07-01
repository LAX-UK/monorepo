import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { artistAlias, artistProfile, artistWatchlist, lot, user } from "@auction/db/schema";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistDeleteGuardCounts,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
  PublicArtistDirectoryResult,
  PublicArtistDirectoryRow,
} from "@auction/types";
import {
  type adminCreateArtistBodySchema,
  type adminUpdateArtistBodySchema,
  parseCreatorAttributes,
} from "@auction/validators";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { AdminArtistListOptions } from "../admin/admin-route-dtos.js";
import { replaceArtistCategoriesInTx } from "../services/artist-registry.service.js";
import type { DbTransaction } from "../services/interfaces/artist-delete.js";
import { computeDirectoryFacets } from "./artist-profile/artist-profile-directory-facets.js";
import {
  aliasCountExpr,
  buildAdminListFilters,
  buildPublicDirectoryWhere,
  lotCountExpr,
  orderByClause,
  publicDirectoryOrderBy,
  publicLotCountExpr,
} from "./artist-profile/artist-profile-list-filters.js";
import { mapAdminListRow, mapArtist } from "./artist-profile/artist-profile-mappers.js";
import {
  loadCategories,
  loadCategoriesForArtists,
} from "./artist-profile/artist-profile-read.helpers.js";

export type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema> & {
  slug: string;
  /** Set by admin route — which staff member created the profile */
  createdByUserId?: string | null;
};
export type UpdateArtistInput = z.infer<typeof adminUpdateArtistBodySchema> & {
  slug?: string | undefined;
};

export class DrizzleArtistProfileRepository {
  constructor(private readonly db: Database) {}

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

    const categoriesById = await loadCategoriesForArtists(
      this.db,
      rows.map((r) => r.ap.id),
    );

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
    return { ...mapArtist(row), categories: await loadCategories(this.db, id) };
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
    const { whereClause, baseWhere } = buildPublicDirectoryWhere(options);

    const [countRow] = await this.db.select({ n: count() }).from(artistProfile).where(whereClause);
    const total = Number(countRow?.n ?? 0);

    const rows = await this.db
      .select({ ap: artistProfile, lotCount: publicLotCountExpr })
      .from(artistProfile)
      .where(whereClause)
      .orderBy(...publicDirectoryOrderBy(options))
      .limit(options.limit)
      .offset(options.offset);

    const facets = await computeDirectoryFacets(this.db, baseWhere);

    const mapped: PublicArtistDirectoryRow[] = rows.map((r) => ({
      ...mapArtist(r.ap),
      lotCount: Number(r.lotCount ?? 0),
    }));
    return { total, rows: mapped, facets };
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
    return { ...mapArtist(row), categories: await loadCategories(this.db, row.id) };
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
    return { ...mapArtist(row), categories: await loadCategories(this.db, row.id) };
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
    return { ...mapArtist(row), categories: await loadCategories(this.db, id) };
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
