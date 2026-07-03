import type { Database } from "@auction/db";
import { artistProfile, artistWatchlist, lot } from "@auction/db/schema";
import type { ArtistDeleteGuardCounts, ArtistKind, ArtistProfile } from "@auction/types";
import { parseCreatorAttributes } from "@auction/validators";
import { and, count, eq } from "drizzle-orm";
import { replaceArtistCategoriesInTx } from "../services/artist-registry.service.js";
import type { DbTransaction } from "../services/interfaces/artist-delete.js";
import { mapArtist } from "./artist-profile/artist-profile-mappers.js";
import { loadCategories } from "./artist-profile/artist-profile-read.helpers.js";
import type {
  CreateArtistInput,
  IArtistProfileCommandRepository,
  UpdateArtistInput,
} from "./interfaces/artist-profile.repository.js";

export class DrizzleArtistProfileCommandRepository implements IArtistProfileCommandRepository {
  constructor(private readonly db: Database) {}

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
