import { randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import {
  adminReviewTask,
  artistAlias,
  artistCategories,
  artistProfile,
  lot,
} from "@auction/db/schema";
import { parseCreatorAttributes } from "@auction/validators";
import { and, asc, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  ArtistKind,
  ArtistRecord,
  ArtistSearchHit,
  ArtistStatus,
  CreateArtistInput,
  IArtistRegistryService,
  MergeArtistInput,
  MergeArtistResult,
  ProposeMatchesInput,
  ProposeMatchesResult,
  ReviewArtistInput,
} from "./interfaces/artist-registry.js";

const FUZZY_THRESHOLD = 0.4;

function partialSearchPattern(query: string): string {
  return `%${query.trim().replace(/[%_\\]/g, "")}%`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Resolves a unique `artist_profile.slug` by appending `-N` on collision.
 * Exported so other services (e.g. submission approval) can inline-create an
 * artist row inside their own transaction without re-implementing the
 * collision logic.
 *
 * `ignoreArtistId` — when provided, treat that artist's existing slug as
 * "free" so admin update flows keep their slug when no other artist holds it. */
export async function resolveUniqueArtistSlug(
  tx: Database,
  displayName: string,
  ignoreArtistId?: string,
): Promise<string> {
  const baseSlug = slugify(displayName);
  if (baseSlug.length === 0) throw new Error("artist_slug_invalid");
  let slug = baseSlug;
  let attempt = 1;
  while (slug.length > 0) {
    const existing = await tx
      .select({ id: artistProfile.id })
      .from(artistProfile)
      .where(eq(artistProfile.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    if (ignoreArtistId && existing[0]?.id === ignoreArtistId) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  throw new Error("artist_slug_resolution_failed");
}

/** Replace the category (department) links for an artist inside a transaction.
 * Centralised so the inline-create path, admin create, and admin update share
 * one policy (delete-then-insert, idempotent). */
export async function replaceArtistCategoriesInTx(
  tx: Database,
  artistProfileId: string,
  categoryIds: readonly string[],
): Promise<void> {
  await tx.delete(artistCategories).where(eq(artistCategories.artistProfileId, artistProfileId));
  const unique = [...new Set(categoryIds)];
  if (unique.length === 0) return;
  await tx
    .insert(artistCategories)
    .values(unique.map((categoryId, index) => ({ artistProfileId, categoryId, sortOrder: index })))
    .onConflictDoNothing();
}

/** Insert a new `artist_profile` row inside the supplied transaction handle.
 * Used by both `ArtistRegistryService.create` and the submission approve flow
 * so the slug logic stays in one place. Defaults to `status = 'pending'` for
 * non-admin paths; admin callers should pass `status: 'approved'`. */
export async function insertArtistInTx(
  tx: Database,
  creatorUserId: string | null,
  input: CreateArtistInput,
): Promise<ArtistRecord> {
  const slug = await resolveUniqueArtistSlug(tx, input.displayName);
  const kind = input.kind ?? "artist";
  const [row] = await tx
    .insert(artistProfile)
    .values({
      displayName: input.displayName,
      slug,
      kind,
      status: input.status ?? "pending",
      shortBio: input.shortBio ?? null,
      nationality: input.nationality ?? null,
      countryCode: input.countryCode ?? null,
      birthYear: input.birthYear ?? null,
      deathYear: input.deathYear ?? null,
      foundedYear: input.foundedYear ?? null,
      dissolvedYear: input.dissolvedYear ?? null,
      attributes: parseCreatorAttributes(kind, input.attributes),
      createdByUserId: creatorUserId,
      ownerUserId: input.ownerUserId ?? null,
    })
    .returning();
  if (!row) throw new Error("artist_create_failed");
  if (input.categoryIds && input.categoryIds.length > 0) {
    await replaceArtistCategoriesInTx(tx, row.id as string, input.categoryIds);
  }
  return rowToRecord(row);
}

function rowToRecord(row: typeof artistProfile.$inferSelect): ArtistRecord {
  return {
    id: row.id as string,
    displayName: row.displayName as string,
    slug: row.slug as string,
    kind: (row.kind as ArtistKind) ?? "artist",
    status: (row.status as ArtistStatus) ?? "approved",
    mergedIntoArtistId: (row.mergedIntoArtistId as string | null) ?? null,
    shortBio: (row.shortBio as string | null) ?? null,
    nationality: (row.nationality as string | null) ?? null,
    birthYear: (row.birthYear as string | null) ?? null,
    deathYear: (row.deathYear as string | null) ?? null,
    createdByUserId: (row.createdByUserId as string | null) ?? null,
    reviewedByUserId: (row.reviewedByUserId as string | null) ?? null,
    reviewedAt: (row.reviewedAt as Date | null) ?? null,
    reviewNotes: (row.reviewNotes as string | null) ?? null,
    rejectionReason: (row.rejectionReason as string | null) ?? null,
    archived: Boolean(row.archived),
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

export class ArtistRegistryService implements IArtistRegistryService {
  constructor(
    private readonly db: Database,
    private readonly domainEvents: DomainEventPublisher | null = null,
  ) {}

  async search(query: string, limit = 10): Promise<ArtistSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const slug = slugify(trimmed);

    // Pass 1: exact slug or display-name match (case-insensitive).
    const exactRows = await this.db
      .select()
      .from(artistProfile)
      .where(
        and(
          ne(artistProfile.status, "merged_into"),
          eq(artistProfile.archived, false),
          sql`(${artistProfile.slug} = ${slug} OR lower(${artistProfile.displayName}) = lower(${trimmed}))`,
        ),
      )
      .limit(limit);
    const exact: ArtistSearchHit[] = exactRows.map((r) => ({
      id: r.id as string,
      displayName: r.displayName as string,
      slug: r.slug as string,
      kind: (r.kind as ArtistKind) ?? "artist",
      status: (r.status as ArtistStatus) ?? "approved",
      matchedAlias: null,
      matchType: "exact",
      score: 1,
    }));
    if (exact.length >= limit) return exact;

    const exactIds = new Set(exact.map((h) => h.id));

    // Pass 2: alias exact match (case-insensitive).
    const aliasRows = await this.db
      .select({
        id: artistProfile.id,
        displayName: artistProfile.displayName,
        slug: artistProfile.slug,
        kind: artistProfile.kind,
        status: artistProfile.status,
        alias: artistAlias.alias,
      })
      .from(artistAlias)
      .innerJoin(artistProfile, eq(artistProfile.id, artistAlias.artistProfileId))
      .where(
        and(
          ne(artistProfile.status, "merged_into"),
          eq(artistProfile.archived, false),
          sql`lower(${artistAlias.alias}) = lower(${trimmed})`,
        ),
      )
      .limit(limit);
    const aliasHits: ArtistSearchHit[] = aliasRows
      .filter((r) => !exactIds.has(r.id as string))
      .map((r) => ({
        id: r.id as string,
        displayName: r.displayName as string,
        slug: r.slug as string,
        kind: (r.kind as ArtistKind) ?? "artist",
        status: (r.status as ArtistStatus) ?? "approved",
        matchedAlias: r.alias,
        matchType: "alias",
        score: 1,
      }));

    if (exact.length + aliasHits.length >= limit) {
      return [...exact, ...aliasHits].slice(0, limit);
    }

    const aliasIds = new Set(aliasHits.map((h) => h.id));
    const skipIds = new Set([...exactIds, ...aliasIds]);
    let remaining = limit - exact.length - aliasHits.length;

    // Pass 3: partial substring match on display name, slug, or alias (admin-list parity).
    const pattern = partialSearchPattern(trimmed);
    const partialRows = await this.db
      .select({
        id: artistProfile.id,
        displayName: artistProfile.displayName,
        slug: artistProfile.slug,
        kind: artistProfile.kind,
        status: artistProfile.status,
        alias: sql<string | null>`(
          select ${artistAlias.alias}
          from ${artistAlias}
          where ${artistAlias.artistProfileId} = ${artistProfile.id}
            and ${artistAlias.alias} ilike ${pattern}
          limit 1
        )`,
      })
      .from(artistProfile)
      .where(
        and(
          ne(artistProfile.status, "merged_into"),
          eq(artistProfile.archived, false),
          or(
            ilike(artistProfile.displayName, pattern),
            ilike(artistProfile.slug, pattern),
            sql`exists (
              select 1 from ${artistAlias}
              where ${artistAlias.artistProfileId} = ${artistProfile.id}
                and ${artistAlias.alias} ilike ${pattern}
            )`,
          ),
        ),
      )
      .orderBy(asc(artistProfile.displayName))
      .limit(remaining + skipIds.size);

    const partialHits: ArtistSearchHit[] = partialRows
      .filter((r) => !skipIds.has(r.id as string))
      .slice(0, remaining)
      .map((r) => ({
        id: r.id as string,
        displayName: r.displayName as string,
        slug: r.slug as string,
        kind: (r.kind as ArtistKind) ?? "artist",
        status: (r.status as ArtistStatus) ?? "approved",
        matchedAlias: r.alias ?? null,
        matchType: "partial",
        score: 0.85,
      }));

    for (const hit of partialHits) skipIds.add(hit.id);
    remaining -= partialHits.length;
    if (remaining <= 0) {
      return [...exact, ...aliasHits, ...partialHits].slice(0, limit);
    }

    // Pass 4: fuzzy via pg_trgm similarity on displayName + alias.
    const fuzzyRows = await this.db
      .select({
        id: artistProfile.id,
        displayName: artistProfile.displayName,
        slug: artistProfile.slug,
        kind: artistProfile.kind,
        status: artistProfile.status,
        score: sql<number>`greatest(
          similarity(${artistProfile.displayName}, ${trimmed}),
          coalesce((select max(similarity(${artistAlias.alias}, ${trimmed})) from ${artistAlias} where ${artistAlias.artistProfileId} = ${artistProfile.id}), 0)
        )`,
      })
      .from(artistProfile)
      .where(
        and(
          ne(artistProfile.status, "merged_into"),
          eq(artistProfile.archived, false),
          sql`(
            similarity(${artistProfile.displayName}, ${trimmed}) >= ${FUZZY_THRESHOLD}
            OR exists (
              select 1 from ${artistAlias}
              where ${artistAlias.artistProfileId} = ${artistProfile.id}
                and similarity(${artistAlias.alias}, ${trimmed}) >= ${FUZZY_THRESHOLD}
            )
          )`,
        ),
      )
      .orderBy(
        sql`greatest(
          similarity(${artistProfile.displayName}, ${trimmed}),
          coalesce((select max(similarity(${artistAlias.alias}, ${trimmed})) from ${artistAlias} where ${artistAlias.artistProfileId} = ${artistProfile.id}), 0)
        ) desc`,
      )
      .limit(remaining + skipIds.size);

    const fuzzy: ArtistSearchHit[] = fuzzyRows
      .filter((r) => !skipIds.has(r.id as string))
      .slice(0, remaining)
      .map((r) => ({
        id: r.id as string,
        displayName: r.displayName as string,
        slug: r.slug as string,
        kind: (r.kind as ArtistKind) ?? "artist",
        status: (r.status as ArtistStatus) ?? "approved",
        matchedAlias: null,
        matchType: "fuzzy",
        score: Number(r.score ?? 0),
      }));

    return [...exact, ...aliasHits, ...partialHits, ...fuzzy];
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

      // Add the merged artist's previous displayName as an alias on the survivor.
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
      // Already existed: fetch to keep the API idempotent.
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

void desc; // exported sort helper used in future routes
