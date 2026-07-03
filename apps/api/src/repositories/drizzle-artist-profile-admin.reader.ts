import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { artistProfile, lot, user } from "@auction/db/schema";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  ArtistKind,
  ArtistProfile,
  ArtistStatus,
} from "@auction/types";
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { AdminArtistListOptions } from "../admin/admin-route-dtos.js";
import {
  aliasCountExpr,
  buildAdminListFilters,
  lotCountExpr,
  orderByClause,
} from "./artist-profile/artist-profile-list-filters.js";
import { mapAdminListRow, mapArtist } from "./artist-profile/artist-profile-mappers.js";
import {
  loadCategories,
  loadCategoriesForArtists,
} from "./artist-profile/artist-profile-read.helpers.js";
import type { IArtistProfileAdminReader } from "./interfaces/artist-profile-admin.reader.js";

export class DrizzleArtistProfileAdminReader implements IArtistProfileAdminReader {
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

  async countLotsByArtist(artistId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(lot)
      .where(and(eq(lot.artistId, artistId), lotNotDeleted()));
    return Number(row?.value ?? 0);
  }
}
