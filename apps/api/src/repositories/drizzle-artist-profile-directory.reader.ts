import type { Database } from "@auction/db";
import { artistAlias, artistProfile } from "@auction/db/schema";
import type { ArtistKind, ArtistProfile, PublicArtistDirectoryResult } from "@auction/types";
import { asc, count, eq } from "drizzle-orm";
import { computeDirectoryFacets } from "./artist-profile/artist-profile-directory-facets.js";
import {
  buildPublicDirectoryWhere,
  publicDirectoryOrderBy,
  publicLotCountExpr,
} from "./artist-profile/artist-profile-list-filters.js";
import { mapArtist } from "./artist-profile/artist-profile-mappers.js";
import { loadCategories } from "./artist-profile/artist-profile-read.helpers.js";
import type { IArtistProfileDirectoryReader } from "./interfaces/artist-profile-directory.reader.js";

export class DrizzleArtistProfileDirectoryReader implements IArtistProfileDirectoryReader {
  constructor(private readonly db: Database) {}

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

    return {
      total,
      rows: rows.map((r) => ({
        ...mapArtist(r.ap),
        lotCount: Number(r.lotCount ?? 0),
      })),
      facets,
    };
  }

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
}
