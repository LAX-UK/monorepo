import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { adminReviewTask, artistAlias, artistProfile, lot } from "@auction/db/schema";
import { and, eq, ilike, sql } from "drizzle-orm";
import { rowToRecord, slugify } from "./artist-registry/artist-registry-helpers.js";
import {
  insertArtistInTx,
  resolveUniqueArtistSlug,
} from "./artist-registry/artist-registry-mutations.js";
import { searchArtists } from "./artist-registry/artist-registry-search.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  ArtistRecord,
  CreateArtistInput,
  IArtistRegistryService,
  MergeArtistInput,
  MergeArtistResult,
  ProposeMatchesInput,
  ProposeMatchesResult,
  ReviewArtistInput,
} from "./interfaces/artist-registry.js";

export {
  insertArtistInTx,
  replaceArtistCategoriesInTx,
  resolveUniqueArtistSlug,
} from "./artist-registry/artist-registry-mutations.js";

export class ArtistRegistryService implements IArtistRegistryService {
  constructor(
    private readonly db: Database,
    private readonly domainEvents: DomainEventPublisher | null = null,
  ) {}

  async search(query: string, limit = 10) {
    return searchArtists(this.db, query, limit);
  }

  async proposeMatches(input: ProposeMatchesInput): Promise<ProposeMatchesResult> {
    const limit = input.limit ?? 5;
    const all = await this.search(input.name, limit * 3);
    return {
      exact: all.filter((h) => h.matchType === "exact").slice(0, limit),
      alias: all.filter((h) => h.matchType === "alias").slice(0, limit),
      fuzzy: all
        .filter((h) => h.matchType === "fuzzy" || h.matchType === "partial")
        .slice(0, limit),
    };
  }

  async proposeMatchesForAdmin(
    actorUserId: string,
    input: ProposeMatchesInput,
  ): Promise<ProposeMatchesResult> {
    const result = await this.proposeMatches(input);
    const publisher = this.domainEvents;
    if (!publisher) return result;
    await this.db.transaction(async (tx) => {
      await publisher.publish(tx, {
        aggregateType: "artist",
        aggregateId: randomUUID(),
        eventType: "artist.propose_matches",
        payload: {
          name: input.name,
          limit: input.limit ?? 5,
          exactCount: result.exact.length,
          aliasCount: result.alias.length,
          fuzzyCount: result.fuzzy.length,
        },
        actorUserId,
      });
    });
    return result;
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

  async create(creatorUserId: string | null, input: CreateArtistInput): Promise<ArtistRecord> {
    return await this.db.transaction((tx) => insertArtistInTx(tx, creatorUserId, input));
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

  async merge(reviewerUserId: string, input: MergeArtistInput): Promise<MergeArtistResult> {
    if (input.fromArtistId === input.intoArtistId) {
      throw new Error("artist_merge_self");
    }
    return await this.db.transaction(async (tx) => {
      const [fromLocked] = await tx
        .select()
        .from(artistProfile)
        .where(eq(artistProfile.id, input.fromArtistId))
        .for("update")
        .limit(1);
      if (!fromLocked) throw new Error("artist_from_not_found");
      if (fromLocked.status === "merged_into") {
        const canonId = (fromLocked.mergedIntoArtistId as string | null) ?? input.intoArtistId;
        const [intoSurvivor] = await tx
          .select()
          .from(artistProfile)
          .where(eq(artistProfile.id, canonId))
          .limit(1);
        if (!intoSurvivor) throw new Error("artist_into_not_found");
        return {
          merged: rowToRecord(fromLocked),
          remaining: rowToRecord(intoSurvivor),
          aliasesMoved: 0,
          lotsMoved: 0,
        };
      }
      const [intoRow] = await tx
        .select()
        .from(artistProfile)
        .where(eq(artistProfile.id, input.intoArtistId))
        .limit(1);
      if (!intoRow) throw new Error("artist_into_not_found");
      const fromRow = fromLocked;

      const aliasResult = await tx
        .update(artistAlias)
        .set({ artistProfileId: input.intoArtistId })
        .where(eq(artistAlias.artistProfileId, input.fromArtistId))
        .returning({ id: artistAlias.id });

      await tx
        .insert(artistAlias)
        .values({
          artistProfileId: input.intoArtistId,
          alias: fromRow.displayName as string,
          kind: "merge_history",
          createdByUserId: reviewerUserId,
        })
        .onConflictDoNothing();

      const lotResult = await tx
        .update(lot)
        .set({ artistId: input.intoArtistId })
        .where(eq(lot.artistId, input.fromArtistId))
        .returning({ id: lot.id });

      const [updatedFrom] = await tx
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

      await tx.insert(adminReviewTask).values({
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

      if (this.domainEvents) {
        await this.domainEvents.publish(tx, {
          aggregateType: "artist",
          aggregateId: input.fromArtistId,
          eventType: "artist.merged",
          payload: {
            fromArtistId: input.fromArtistId,
            intoArtistId: input.intoArtistId,
            reason: input.reason,
            aliasesMoved: aliasResult.length,
            lotsMoved: lotResult.length,
          },
          actorUserId: reviewerUserId,
        });
      }

      return {
        merged: rowToRecord(updatedFrom),
        remaining: rowToRecord(intoRow),
        aliasesMoved: aliasResult.length,
        lotsMoved: lotResult.length,
      };
    });
  }

  async review(
    reviewerUserId: string,
    artistId: string,
    input: ReviewArtistInput,
  ): Promise<ArtistRecord> {
    return await this.db.transaction(async (tx) => {
      const [updated] = await tx
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
        await tx
          .update(lot)
          .set({ artistReviewRequired: false })
          .where(and(eq(lot.artistId, artistId), eq(lot.artistReviewRequired, true)));
      }

      if (this.domainEvents) {
        await this.domainEvents.publish(tx, {
          aggregateType: "artist",
          aggregateId: artistId,
          eventType: "artist.reviewed",
          payload: {
            decision: input.decision,
            reviewNotes: input.reviewNotes ?? null,
            rejectionReason: input.decision === "rejected" ? (input.rejectionReason ?? null) : null,
          },
          actorUserId: reviewerUserId,
        });
      }

      return rowToRecord(updated);
    });
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
}
