import type { Database } from "@auction/db";
import { artistProfile } from "@auction/db/schema";
import type { ArtistProfile } from "@auction/types";
import type { adminCreateArtistBodySchema, adminUpdateArtistBodySchema } from "@auction/validators";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { z } from "zod";

export type CreateArtistInput = z.infer<typeof adminCreateArtistBodySchema> & { slug: string };
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
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleArtistProfileRepository {
  constructor(private readonly db: Database) {}

  async list(options: { includeArchived?: boolean; q?: string } = {}): Promise<ArtistProfile[]> {
    const filters = [];
    if (!options.includeArchived) filters.push(eq(artistProfile.archived, false));
    if (options.q?.trim()) {
      const q = `%${options.q.trim().replace(/[%_\\]/g, "")}%`;
      filters.push(or(ilike(artistProfile.displayName, q), ilike(artistProfile.slug, q)));
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
        ...input,
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
}
