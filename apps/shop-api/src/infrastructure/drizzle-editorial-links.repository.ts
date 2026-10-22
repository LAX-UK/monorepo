import { createHash } from "node:crypto";
import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopEditorialExhibition,
  shopEditorialExhibitionArtist,
  shopEditorialExhibitionArtwork,
  shopEditorialStory,
  shopEditorialStoryArtist,
  shopEditorialStoryArtwork,
  shopEditorialStoryExhibition,
  shopParty,
} from "@auction/db/schema";
import type {
  EditorialLinkItem,
  EditorialLinkKind,
  EditorialStoryLinkList,
} from "@auction/shop-contracts";
import { type SQL, and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  decodeEditorialLinkCandidateCursor,
  encodeEditorialLinkCandidateCursor,
} from "../application/editorial-link-candidate-cursor.js";
import type {
  EditorialLinksRepository,
  ReplaceEditorialLinksOutcome,
} from "../application/ports/editorial-links.repository.js";
import { exhibitionSummaryOrder, storySummaryOrder } from "./drizzle-editorial-relations.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;

/** A drizzle database or an open transaction on it. */
type Executor = Pick<Database, "select" | "insert" | "delete" | "update" | "execute">;

type ItemRow = {
  id: string;
  title: string;
  slug: string;
  thumbnailKey: string | null;
  published: boolean;
};

type ItemSource = {
  id: AnyPgColumn;
  title: AnyPgColumn;
  slug: AnyPgColumn;
  /** Rows matching `where`, ordered by title then id, so candidates page with a keyset. */
  fetch(executor: Executor, where: SQL | undefined, limit?: number): Promise<ItemRow[]>;
};

/** Artworks reach lax.art only through the Art channel, so that is their "published" state. */
const artworkSource: ItemSource = {
  id: shopArtwork.id,
  title: shopArtwork.title,
  slug: shopArtwork.slug,
  fetch: (executor, where, limit) => {
    const query = executor
      .select({
        id: shopArtwork.id,
        title: shopArtwork.title,
        slug: shopArtwork.slug,
        thumbnailKey: shopArtwork.primaryImageUrl,
        published: sql<boolean>`${shopArtwork.salesChannel} = 'art'`,
      })
      .from(shopArtwork)
      .where(where)
      .orderBy(asc(shopArtwork.title), asc(shopArtwork.id))
      .$dynamic();
    return limit === undefined ? query : query.limit(limit);
  },
};

const artistSource: ItemSource = {
  id: shopArtist.id,
  title: shopParty.displayName,
  slug: shopArtist.slug,
  fetch: (executor, where, limit) => {
    const query = executor
      .select({
        id: shopArtist.id,
        title: shopParty.displayName,
        slug: shopArtist.slug,
        thumbnailKey: sql<
          string | null
        >`coalesce(${shopArtist.portraitImageUrl}, ${shopArtist.heroMediaKey})`,
        published: sql<boolean>`true`,
      })
      .from(shopArtist)
      .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
      .where(where)
      .orderBy(asc(shopParty.displayName), asc(shopArtist.id))
      .$dynamic();
    return limit === undefined ? query : query.limit(limit);
  },
};

const storySource: ItemSource = {
  id: shopEditorialStory.id,
  title: shopEditorialStory.title,
  slug: shopEditorialStory.slug,
  fetch: (executor, where, limit) => {
    const query = executor
      .select({
        id: shopEditorialStory.id,
        title: shopEditorialStory.title,
        slug: shopEditorialStory.slug,
        thumbnailKey: shopEditorialStory.coverMediaKey,
        published: sql<boolean>`${shopEditorialStory.status} = 'published'`,
      })
      .from(shopEditorialStory)
      .where(where)
      .orderBy(asc(shopEditorialStory.title), asc(shopEditorialStory.id))
      .$dynamic();
    return limit === undefined ? query : query.limit(limit);
  },
};

const exhibitionSource: ItemSource = {
  id: shopEditorialExhibition.id,
  title: shopEditorialExhibition.title,
  slug: shopEditorialExhibition.slug,
  fetch: (executor, where, limit) => {
    const query = executor
      .select({
        id: shopEditorialExhibition.id,
        title: shopEditorialExhibition.title,
        slug: shopEditorialExhibition.slug,
        thumbnailKey: shopEditorialExhibition.coverMediaKey,
        published: sql<boolean>`${shopEditorialExhibition.status} = 'published'`,
      })
      .from(shopEditorialExhibition)
      .where(where)
      .orderBy(asc(shopEditorialExhibition.title), asc(shopEditorialExhibition.id))
      .$dynamic();
    return limit === undefined ? query : query.limit(limit);
  },
};

const ITEM_SOURCES: Record<EditorialLinkKind, ItemSource> = {
  artwork: artworkSource,
  artist: artistSource,
  story: storySource,
  exhibition: exhibitionSource,
};

type ExhibitionIds = { artworks: string[]; artists: string[]; stories: string[] };
type StoryIds = { artists: string[]; artworks: string[]; exhibitions: string[] };

/**
 * Serialises writers of the story/exhibition join. It has two parents, and a row lock on
 * one of them would not stop an editor changing the same pair from the other side.
 */
const STORY_EXHIBITION_LOCK = sql`select pg_advisory_xact_lock(hashtext('shop_editorial_story_exhibition'))`;

/**
 * The version is a hash of every ordered id list the parent owns, not its `updated_at`.
 * Story and exhibition links share one table, so an edit from one side must change the other
 * side's version too, and only a content-derived value does that without touching a second row.
 * It also cannot collide for two writes inside the same millisecond, which a timestamp could.
 */
export function editorialLinksVersion(lists: Record<string, string[]>): string {
  const canonical = Object.keys(lists)
    .sort()
    .map((name) => `${name}:${(lists[name] ?? []).join(",")}`)
    .join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

export function createDrizzleEditorialLinksRepository(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): EditorialLinksRepository {
  const { resolveMediaUrl } = options;

  const toItem = (row: ItemRow): EditorialLinkItem => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    thumbnailUrl: resolveMediaUrl(row.thumbnailKey),
    published: row.published,
  });

  async function itemsInOrder(
    executor: Executor,
    kind: EditorialLinkKind,
    ids: string[],
  ): Promise<EditorialLinkItem[]> {
    if (ids.length === 0) return [];
    const source = ITEM_SOURCES[kind];
    const rows = await source.fetch(executor, inArray(source.id, ids));
    const byId = new Map(rows.map((row) => [row.id, toItem(row)]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  // The queries below run one after another: inside a transaction they share a single connection.
  async function exhibitionIds(executor: Executor, exhibitionId: string): Promise<ExhibitionIds> {
    const artworks = await executor
      .select({ id: shopEditorialExhibitionArtwork.artworkId })
      .from(shopEditorialExhibitionArtwork)
      .where(eq(shopEditorialExhibitionArtwork.exhibitionId, exhibitionId))
      .orderBy(asc(shopEditorialExhibitionArtwork.position));
    const artists = await executor
      .select({ id: shopEditorialExhibitionArtist.artistId })
      .from(shopEditorialExhibitionArtist)
      .where(eq(shopEditorialExhibitionArtist.exhibitionId, exhibitionId))
      .orderBy(
        asc(shopEditorialExhibitionArtist.position),
        asc(shopEditorialExhibitionArtist.artistId),
      );
    // No stored order; the same order the public exhibition page shows its stories in.
    const stories = await executor
      .select({ id: shopEditorialStory.id })
      .from(shopEditorialStoryExhibition)
      .innerJoin(
        shopEditorialStory,
        eq(shopEditorialStory.id, shopEditorialStoryExhibition.storyId),
      )
      .where(eq(shopEditorialStoryExhibition.exhibitionId, exhibitionId))
      .orderBy(...storySummaryOrder);
    return {
      artworks: artworks.map((row) => row.id),
      artists: artists.map((row) => row.id),
      stories: stories.map((row) => row.id),
    };
  }

  async function storyIds(executor: Executor, storyId: string): Promise<StoryIds> {
    const artists = await executor
      .select({ id: shopEditorialStoryArtist.artistId })
      .from(shopEditorialStoryArtist)
      .where(eq(shopEditorialStoryArtist.storyId, storyId))
      .orderBy(asc(shopEditorialStoryArtist.position), asc(shopEditorialStoryArtist.artistId));
    const artworks = await executor
      .select({ id: shopEditorialStoryArtwork.artworkId })
      .from(shopEditorialStoryArtwork)
      .where(eq(shopEditorialStoryArtwork.storyId, storyId))
      .orderBy(asc(shopEditorialStoryArtwork.position), asc(shopEditorialStoryArtwork.artworkId));
    // No stored order; the same order the public story page shows its exhibitions in.
    const exhibitions = await executor
      .select({ id: shopEditorialExhibition.id })
      .from(shopEditorialStoryExhibition)
      .innerJoin(
        shopEditorialExhibition,
        eq(shopEditorialExhibition.id, shopEditorialStoryExhibition.exhibitionId),
      )
      .where(eq(shopEditorialStoryExhibition.storyId, storyId))
      .orderBy(...exhibitionSummaryOrder);
    return {
      artists: artists.map((row) => row.id),
      artworks: artworks.map((row) => row.id),
      exhibitions: exhibitions.map((row) => row.id),
    };
  }

  async function missingIds(
    executor: Executor,
    kind: EditorialLinkKind,
    ids: string[],
  ): Promise<string[]> {
    if (ids.length === 0) return [];
    const source = ITEM_SOURCES[kind];
    const found = await source.fetch(executor, inArray(source.id, ids));
    const known = new Set(found.map((row) => row.id));
    return ids.filter((id) => !known.has(id));
  }

  /**
   * Shared by every list: lock, compare the version, check the ids exist, then let the caller
   * rewrite the join. Nothing is written before the checks pass, so a refusal leaves no trace.
   */
  async function replaceList<Ids extends Record<string, string[]>>(args: {
    parentTable: typeof shopEditorialExhibition | typeof shopEditorialStory;
    parentType: "editorial_exhibition" | "editorial_story";
    auditAction: string;
    parentId: string;
    list: keyof Ids & string;
    targetKind: EditorialLinkKind;
    ids: string[];
    expectedVersion: string;
    actorSubjectId: string;
    sharesStoryExhibitionTable: boolean;
    loadIds: (executor: Executor, parentId: string) => Promise<Ids>;
    rewrite: (executor: Executor) => Promise<void>;
  }): Promise<ReplaceEditorialLinksOutcome> {
    return db.transaction(async (tx) => {
      const executor: Executor = tx;
      if (args.sharesStoryExhibitionTable) await executor.execute(STORY_EXHIBITION_LOCK);
      const [parent] = await executor
        .select({ id: args.parentTable.id })
        .from(args.parentTable)
        .where(eq(args.parentTable.id, args.parentId))
        .for("update");
      if (!parent) return { status: "parent_not_found" };

      const before = await args.loadIds(executor, args.parentId);
      const currentVersion = editorialLinksVersion(before);
      if (currentVersion !== args.expectedVersion) return { status: "stale", currentVersion };

      const missing = await missingIds(executor, args.targetKind, args.ids);
      if (missing.length > 0) return { status: "unknown_ids", missingIds: missing };

      await args.rewrite(executor);
      await executor
        .update(args.parentTable)
        .set({ updatedBy: args.actorSubjectId, updatedAt: new Date() })
        .where(eq(args.parentTable.id, args.parentId));
      await insertShopAdminAudit(executor as Database, {
        actorSubjectId: args.actorSubjectId,
        capability: "editorial.write",
        action: args.auditAction,
        targetType: args.parentType,
        targetId: args.parentId,
        beforeJson: { list: args.list, ids: before[args.list] ?? [] },
        afterJson: { list: args.list, ids: args.ids },
      });
      return {
        status: "replaced",
        version: editorialLinksVersion(await args.loadIds(executor, args.parentId)),
      };
    });
  }

  const positioned = (ids: string[]) => ids.map((id, position) => ({ id, position }));

  return {
    async getExhibitionLinks(exhibitionId) {
      const [exists] = await db
        .select({ id: shopEditorialExhibition.id })
        .from(shopEditorialExhibition)
        .where(eq(shopEditorialExhibition.id, exhibitionId))
        .limit(1);
      if (!exists) return null;
      const ids = await exhibitionIds(db, exhibitionId);
      const [artworks, artists, stories] = await Promise.all([
        itemsInOrder(db, "artwork", ids.artworks),
        itemsInOrder(db, "artist", ids.artists),
        itemsInOrder(db, "story", ids.stories),
      ]);
      return { artworks, artists, stories, version: editorialLinksVersion(ids) };
    },

    async getStoryLinks(storyId) {
      const [exists] = await db
        .select({ id: shopEditorialStory.id })
        .from(shopEditorialStory)
        .where(eq(shopEditorialStory.id, storyId))
        .limit(1);
      if (!exists) return null;
      const ids = await storyIds(db, storyId);
      const [artists, artworks, exhibitions] = await Promise.all([
        itemsInOrder(db, "artist", ids.artists),
        itemsInOrder(db, "artwork", ids.artworks),
        itemsInOrder(db, "exhibition", ids.exhibitions),
      ]);
      return { artists, artworks, exhibitions, version: editorialLinksVersion(ids) };
    },

    replaceExhibitionLinks(input) {
      const { parentId: exhibitionId, list, ids } = input;
      const rewrites = {
        artworks: async (tx: Executor) => {
          await tx
            .delete(shopEditorialExhibitionArtwork)
            .where(eq(shopEditorialExhibitionArtwork.exhibitionId, exhibitionId));
          if (ids.length > 0) {
            await tx.insert(shopEditorialExhibitionArtwork).values(
              positioned(ids).map(({ id, position }) => ({
                exhibitionId,
                artworkId: id,
                position,
              })),
            );
          }
        },
        artists: async (tx: Executor) => {
          await tx
            .delete(shopEditorialExhibitionArtist)
            .where(eq(shopEditorialExhibitionArtist.exhibitionId, exhibitionId));
          if (ids.length > 0) {
            await tx.insert(shopEditorialExhibitionArtist).values(
              positioned(ids).map(({ id, position }) => ({
                exhibitionId,
                artistId: id,
                position,
              })),
            );
          }
        },
        stories: async (tx: Executor) => {
          await tx
            .delete(shopEditorialStoryExhibition)
            .where(eq(shopEditorialStoryExhibition.exhibitionId, exhibitionId));
          if (ids.length > 0) {
            await tx
              .insert(shopEditorialStoryExhibition)
              .values(ids.map((storyId) => ({ storyId, exhibitionId })));
          }
        },
      };
      return replaceList<ExhibitionIds>({
        ...input,
        parentTable: shopEditorialExhibition,
        parentType: "editorial_exhibition",
        auditAction: "editorial.exhibition.links.replace",
        list,
        targetKind: list === "artworks" ? "artwork" : list === "artists" ? "artist" : "story",
        sharesStoryExhibitionTable: list === "stories",
        loadIds: exhibitionIds,
        rewrite: rewrites[list],
      });
    },

    replaceStoryLinks(input) {
      const { parentId: storyId, list, ids } = input;
      const rewrites: Record<EditorialStoryLinkList, (tx: Executor) => Promise<void>> = {
        artists: async (tx) => {
          await tx
            .delete(shopEditorialStoryArtist)
            .where(eq(shopEditorialStoryArtist.storyId, storyId));
          if (ids.length > 0) {
            await tx
              .insert(shopEditorialStoryArtist)
              .values(
                positioned(ids).map(({ id, position }) => ({ storyId, artistId: id, position })),
              );
          }
        },
        artworks: async (tx) => {
          await tx
            .delete(shopEditorialStoryArtwork)
            .where(eq(shopEditorialStoryArtwork.storyId, storyId));
          if (ids.length > 0) {
            await tx
              .insert(shopEditorialStoryArtwork)
              .values(
                positioned(ids).map(({ id, position }) => ({ storyId, artworkId: id, position })),
              );
          }
        },
        exhibitions: async (tx) => {
          await tx
            .delete(shopEditorialStoryExhibition)
            .where(eq(shopEditorialStoryExhibition.storyId, storyId));
          if (ids.length > 0) {
            await tx
              .insert(shopEditorialStoryExhibition)
              .values(ids.map((exhibitionId) => ({ storyId, exhibitionId })));
          }
        },
      };
      return replaceList<StoryIds>({
        ...input,
        parentTable: shopEditorialStory,
        parentType: "editorial_story",
        auditAction: "editorial.story.links.replace",
        list,
        targetKind: list === "artists" ? "artist" : list === "artworks" ? "artwork" : "exhibition",
        sharesStoryExhibitionTable: list === "exhibitions",
        loadIds: storyIds,
        rewrite: rewrites[list],
      });
    },

    async searchCandidates({ kind, q, cursor, limit }) {
      const source = ITEM_SOURCES[kind];
      const after = decodeEditorialLinkCandidateCursor(cursor);
      const pattern = containsPattern(q);
      const conditions: SQL[] = [];
      if (q) {
        const match = or(ilike(source.title, pattern), ilike(source.slug, pattern));
        if (match) conditions.push(match);
      }
      if (after)
        conditions.push(sql`(${source.title}, ${source.id}) > (${after.title}, ${after.id}::uuid)`);
      const rows = await source.fetch(db, and(...conditions), limit + 1);
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        items: page.map(toItem),
        nextCursor:
          rows.length > limit && last
            ? encodeEditorialLinkCandidateCursor({ title: last.title, id: last.id })
            : null,
      };
    },
  };
}
