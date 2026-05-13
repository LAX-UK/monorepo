import type { Database } from "@auction/db";
import { artistProfile, lot } from "@auction/db/schema";
import type { ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import type { z } from "zod";

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
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    websiteUrl: row.websiteUrl,
    socialLinks: row.socialLinks,
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
      filters.push(or(ilike(artistProfile.displayName, q), ilike(artistProfile.slug, q)));
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

  async findById(id: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, id))
      .limit(1);
    return row ? mapArtist(row) : null;
  }

  async findBySlug(slug: string): Promise<ArtistProfile | null> {
    const [row] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    return row ? mapArtist(row) : null;
  }

  async create(input: CreateArtistInput): Promise<ArtistProfile> {
    const [row] = await this.db
      .insert(artistProfile)
      .values({
        displayName: input.displayName,
        slug: input.slug,
        kind: input.kind ?? "artist",
        status: input.status ?? "approved",
        portraitUrl: input.portraitUrl ?? null,
        heroImageUrl: input.heroImageUrl ?? null,
        shortBio: input.shortBio ?? null,
        longBio: input.longBio ?? null,
        statement: input.statement ?? null,
        nationality: input.nationality ?? null,
        location: input.location ?? null,
        birthYear: input.birthYear ?? null,
        deathYear: input.deathYear ?? null,
        websiteUrl: input.websiteUrl ?? null,
        ownerUserId: input.ownerUserId ?? null,
        createdByUserId: input.createdByUserId ?? null,
        featured: input.featured ?? false,
        verified: input.verified ?? false,
        archived: input.archived ?? false,
      })
      .returning();
    if (!row) throw new Error("Artist create failed");
    return mapArtist(row);
  }

  async update(id: string, input: UpdateArtistInput): Promise<ArtistProfile | null> {
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
        ...(input.birthYear !== undefined ? { birthYear: input.birthYear ?? null } : {}),
        ...(input.deathYear !== undefined ? { deathYear: input.deathYear ?? null } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
        ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId ?? null } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.verified !== undefined ? { verified: input.verified } : {}),
        ...(input.archived !== undefined ? { archived: input.archived } : {}),
        updatedAt: new Date(),
      })
      .where(eq(artistProfile.id, id))
      .returning();
    return row ? mapArtist(row) : null;
  }

  /** Count of `lot` rows currently attached to a given artist via FK. Used by
   * the admin artist list to surface "N lots" badges. */
  async countLotsByArtist(artistId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(lot)
      .where(eq(lot.artistId, artistId));
    return Number(row?.value ?? 0);
  }
}
