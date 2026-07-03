import type { Database } from "@auction/db";
import { adminReviewTask, artistAlias, artistProfile, lot } from "@auction/db/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import type {
  ArtistRecord,
  CreateArtistInput,
  MergeArtistInput,
  MergeArtistResult,
  ReviewArtistInput,
} from "../services/interfaces/artist-registry.js";
import { insertArtistInTx, resolveUniqueArtistSlug } from "./artist-registry-mutations.js";
import { searchArtists } from "./artist-registry-search.js";
import { rowToRecord, slugify } from "./artist-registry.helpers.js";
import type { IArtistRegistryRepository } from "./interfaces/artist-registry.repository.js";

export class DrizzleArtistRegistryRepository implements IArtistRegistryRepository {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IArtistRegistryRepository {
    return new DrizzleArtistRegistryRepository(conn);
  }

  search(query: string, limit = 10) {
    return searchArtists(this.db, query, limit);
  }

  async findById(id: string): Promise<ArtistRecord | null> {
    const rows = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, id))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async findBySlug(slug: string): Promise<ArtistRecord | null> {
    const rows = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord> {
    return this.db.transaction((tx) => insertArtistInTx(tx, creatorUserId, input));
  }

  resolveUniqueSlug(input: string, ignoreArtistId?: string): Promise<string> {
    return resolveUniqueArtistSlug(this.db, input, ignoreArtistId);
  }

  async checkNameAvailability(displayName: string) {
    const slug = slugify(displayName);
    if (!slug) return { available: false, suggestions: [] };
    const exists = await this.db
      .select({ id: artistProfile.id })
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    if (exists.length === 0) return { available: true, suggestions: [] };

    const taken = await this.db
      .select({ slug: artistProfile.slug })
      .from(artistProfile)
      .where(sql`${artistProfile.slug} like ${`${slug}-%`}`);
    const takenSet = new Set(taken.map((t) => t.slug as string));
    const suggestions: string[] = [];
    for (let n = 2; suggestions.length < 3 && n < 12; n += 1) {
      const candidate = `${slug}-${n}`;
      if (!takenSet.has(candidate)) suggestions.push(candidate);
    }
    return { available: false, suggestions };
  }

  async merge(
    reviewerUserId: string,
    input: MergeArtistInput,
  ): Promise<{ result: MergeArtistResult; performed: boolean }> {
    const [fromLocked] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, input.fromArtistId))
      .for("update")
      .limit(1);
    if (!fromLocked) throw new Error("artist_from_not_found");
    if (fromLocked.status === "merged_into") {
      const canonId = (fromLocked.mergedIntoArtistId as string | null) ?? input.intoArtistId;
      const [intoSurvivor] = await this.db
        .select()
        .from(artistProfile)
        .where(eq(artistProfile.id, canonId))
        .limit(1);
      if (!intoSurvivor) throw new Error("artist_into_not_found");
      return {
        performed: false,
        result: {
          merged: rowToRecord(fromLocked),
          remaining: rowToRecord(intoSurvivor),
          aliasesMoved: 0,
          lotsMoved: 0,
        },
      };
    }
    const [intoRow] = await this.db
      .select()
      .from(artistProfile)
      .where(eq(artistProfile.id, input.intoArtistId))
      .limit(1);
    if (!intoRow) throw new Error("artist_into_not_found");
    const fromRow = fromLocked;

    const aliasResult = await this.db
      .update(artistAlias)
      .set({ artistProfileId: input.intoArtistId })
      .where(eq(artistAlias.artistProfileId, input.fromArtistId))
      .returning({ id: artistAlias.id });

    await this.db
      .insert(artistAlias)
      .values({
        artistProfileId: input.intoArtistId,
        alias: fromRow.displayName as string,
        kind: "merge_history",
        createdByUserId: reviewerUserId,
      })
      .onConflictDoNothing();

    const lotResult = await this.db
      .update(lot)
      .set({ artistId: input.intoArtistId })
      .where(eq(lot.artistId, input.fromArtistId))
      .returning({ id: lot.id });

    const [updatedFrom] = await this.db
      .update(artistProfile)
      .set({
        status: "merged_into",
        mergedIntoArtistId: input.intoArtistId,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reason,
        updatedAt: new Date(),
      })
      .where(eq(artistProfile.id, input.fromArtistId))
      .returning();
    if (!updatedFrom) throw new Error("artist_merge_failed");

    await this.db.insert(adminReviewTask).values({
      kind: "artist_merge_review",
      status: "resolved",
      payload: {
        fromArtistId: input.fromArtistId,
        intoArtistId: input.intoArtistId,
        reason: input.reason,
        aliasesMoved: aliasResult.length,
        lotsMoved: lotResult.length,
      },
      resolvedByUserId: reviewerUserId,
      resolvedAt: new Date(),
      resolutionNotes: input.reason,
    });

    return {
      performed: true,
      result: {
        merged: rowToRecord(updatedFrom),
        remaining: rowToRecord(intoRow),
        aliasesMoved: aliasResult.length,
        lotsMoved: lotResult.length,
      },
    };
  }

  async review(
    reviewerUserId: string,
    artistId: string,
    input: ReviewArtistInput,
  ): Promise<ArtistRecord> {
    const [updated] = await this.db
      .update(artistProfile)
      .set({
        status: input.decision,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewNotes: input.reviewNotes ?? null,
        rejectionReason: input.decision === "rejected" ? (input.rejectionReason ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(artistProfile.id, artistId))
      .returning();
    if (!updated) throw new Error("artist_not_found");

    if (input.decision === "approved") {
      await this.db
        .update(lot)
        .set({ artistReviewRequired: false })
        .where(and(eq(lot.artistId, artistId), eq(lot.artistReviewRequired, true)));
    }

    return rowToRecord(updated);
  }

  async addAlias(
    creatorUserId: string | null,
    artistId: string,
    alias: string,
    kind = "synonym",
  ): Promise<{ id: string; alias: string }> {
    const [row] = await this.db
      .insert(artistAlias)
      .values({
        artistProfileId: artistId,
        alias: alias.trim(),
        kind,
        createdByUserId: creatorUserId,
      })
      .onConflictDoNothing()
      .returning({ id: artistAlias.id, alias: artistAlias.alias });
    if (!row) {
      const [existing] = await this.db
        .select({ id: artistAlias.id, alias: artistAlias.alias })
        .from(artistAlias)
        .where(
          and(eq(artistAlias.artistProfileId, artistId), ilike(artistAlias.alias, alias.trim())),
        )
        .limit(1);
      if (!existing) throw new Error("artist_alias_create_failed");
      return existing;
    }
    return row;
  }

  runTransaction<T>(fn: (repo: IArtistRegistryRepository, tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(this.forConnection(tx), tx));
  }
}
