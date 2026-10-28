import type { Database } from "@auction/db";
import {
  shopArtist,
  shopArtwork,
  shopArtworkCategory,
  shopArtworkImage,
  shopCategory,
  shopHomePlacement,
  shopParty,
} from "@auction/db/schema";
import type {
  AdminHomeFeatureArtist,
  AdminHomeFeatureCategory,
  AdminHomeFeaturePrint,
  AdminHomeFeatureRow,
} from "@auction/shop-contracts";
import type { HomeFeatureSlot, HomeFeatureTargetFacts } from "@auction/shop-domain";
import { type SQL, and, asc, desc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import type {
  HomeFeatureListReader,
  HomeFeatureTargetReader,
} from "../../application/home-features/home-features.ports.js";
import { publicArtistVisible, publicArtworkVisible } from "../artwork-visibility-sql.js";
import { containsPattern } from "../drizzle-editorial-search.reader.js";
import { listedOnSalesChannelSql } from "../sales-channel-listing-sql.js";
import { artworkAvailableNowSql } from "../shop-edition-availability.js";

type ResolveMediaUrl = (value: string | null | undefined) => string | null;
type SearchQuery = { q?: string; limit: number };

/** A Shop edition: listed on the Shop as a run of prints, whatever its publishing state. */
const shopEditionSql = listedOnSalesChannelSql("shop");

/** What the Shop home sees: a published Shop edition. */
const liveShopEditionSql = and(shopEditionSql, publicArtworkVisible()) as SQL;

const firstImageKeySql = sql<string | null>`(
  select ${shopArtworkImage.mediaKey} from ${shopArtworkImage}
  where ${shopArtworkImage.artworkId} = ${shopArtwork.id}
  order by ${shopArtworkImage.position} asc limit 1
)`;

/** An artist's live artwork matching `listing`, for the artist row's where-they-appear facts. */
function artistHasArtwork(db: Database, listing: SQL): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(shopArtwork)
      .where(and(eq(shopArtwork.artistId, shopArtist.id), listing, publicArtworkVisible())),
  );
}

function printColumns() {
  return {
    id: shopArtwork.id,
    title: shopArtwork.title,
    artistName: shopParty.displayName,
    primaryImageUrl: shopArtwork.primaryImageUrl,
    firstImageKey: firstImageKeySql,
    live: sql<boolean>`${liveShopEditionSql}`,
    available: sql<boolean>`${artworkAvailableNowSql}`,
  };
}

function artistColumns(db: Database) {
  return {
    id: shopArtist.id,
    name: shopParty.displayName,
    discipline: shopArtist.discipline,
    portraitImageUrl: shopArtist.portraitImageUrl,
    onArt: sql<boolean>`${and(publicArtistVisible(), artistHasArtwork(db, listedOnSalesChannelSql("art")))}`,
    hasEditionsOnSale: sql<boolean>`${and(
      publicArtistVisible(),
      artistHasArtwork(db, and(shopEditionSql, artworkAvailableNowSql) as SQL),
    )}`,
  };
}

function categoryColumns() {
  return {
    id: shopCategory.id,
    name: shopCategory.label,
    editionCount: sql<number>`(
      select count(*)::int from ${shopArtworkCategory}
      inner join ${shopArtwork} on ${shopArtwork.id} = ${shopArtworkCategory.artworkId}
      where ${shopArtworkCategory.categoryId} = ${shopCategory.id} and ${liveShopEditionSql}
    )`,
  };
}

type PrintRow = {
  id: string;
  title: string;
  artistName: string;
  primaryImageUrl: string | null;
  firstImageKey: string | null;
  live: boolean;
  available: boolean;
};

function toPrint(row: PrintRow, resolveMediaUrl: ResolveMediaUrl): AdminHomeFeaturePrint {
  const image = row.primaryImageUrl ?? row.firstImageKey;
  return {
    id: row.id,
    title: row.title,
    artistName: row.artistName,
    thumbnailUrl: image ? resolveMediaUrl(image) : null,
    live: row.live,
    soldOut: !row.available,
    hasImage: image !== null,
  };
}

function toArtist(
  row: {
    id: string;
    name: string;
    discipline: string | null;
    portraitImageUrl: string | null;
    onArt: boolean;
    hasEditionsOnSale: boolean;
  },
  resolveMediaUrl: ResolveMediaUrl,
): AdminHomeFeatureArtist {
  return {
    id: row.id,
    name: row.name,
    discipline: row.discipline,
    portraitUrl: row.portraitImageUrl ? resolveMediaUrl(row.portraitImageUrl) : null,
    onArt: row.onArt,
    hasEditionsOnSale: row.hasEditionsOnSale,
  };
}

function toCategory(row: { id: string; name: string; editionCount: number }) {
  return { id: row.id, name: row.name, editionCount: Number(row.editionCount) };
}

/** Each slot's queries, so a new slot is one more entry rather than another branch. */
type SlotQueries<Row> = {
  placed(): Promise<Row[]>;
  search(query: SearchQuery): Promise<Row[]>;
  facts(ids: readonly string[]): Promise<HomeFeatureTargetFacts[]>;
};

function slotQueries(db: Database, resolveMediaUrl: ResolveMediaUrl) {
  const placedIn = (slot: HomeFeatureSlot) => eq(shopHomePlacement.slot, slot);
  const pattern = (query: SearchQuery) =>
    query.q?.trim() ? containsPattern(query.q.trim()) : null;

  const prints: SlotQueries<AdminHomeFeaturePrint> = {
    async placed() {
      const rows = await db
        .select(printColumns())
        .from(shopHomePlacement)
        .innerJoin(shopArtwork, eq(shopHomePlacement.artworkId, shopArtwork.id))
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(placedIn("featured_prints"))
        .orderBy(asc(shopHomePlacement.position));
      return rows.map((row) => toPrint(row, resolveMediaUrl));
    },
    async search(query) {
      const like = pattern(query);
      const rows = await db
        .select(printColumns())
        .from(shopArtwork)
        .innerJoin(shopArtist, eq(shopArtwork.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            shopEditionSql,
            isNull(shopArtwork.archivedAt),
            like
              ? or(
                  sql`${shopArtwork.title} ILIKE ${like}`,
                  sql`${shopParty.displayName} ILIKE ${like}`,
                )
              : undefined,
          ),
        )
        .orderBy(desc(shopArtwork.createdAt), asc(shopArtwork.id))
        .limit(query.limit);
      return rows.map((row) => toPrint(row, resolveMediaUrl));
    },
    async facts(ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select({ id: shopArtwork.id, isShopEdition: sql<boolean>`${shopEditionSql}` })
        .from(shopArtwork)
        .where(inArray(shopArtwork.id, [...ids]));
      return rows.map((row) => ({ kind: "artwork", id: row.id, isShopEdition: row.isShopEdition }));
    },
  };

  const artists: SlotQueries<AdminHomeFeatureArtist> = {
    async placed() {
      const rows = await db
        .select(artistColumns(db))
        .from(shopHomePlacement)
        .innerJoin(shopArtist, eq(shopHomePlacement.artistId, shopArtist.id))
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(placedIn("featured_artists"))
        .orderBy(asc(shopHomePlacement.position));
      return rows.map((row) => toArtist(row, resolveMediaUrl));
    },
    async search(query) {
      const like = pattern(query);
      const rows = await db
        .select(artistColumns(db))
        .from(shopArtist)
        .innerJoin(shopParty, eq(shopArtist.partyId, shopParty.id))
        .where(
          and(
            publicArtistVisible(),
            like ? sql`${shopParty.displayName} ILIKE ${like}` : undefined,
          ),
        )
        .orderBy(asc(shopParty.displayName), asc(shopArtist.id))
        .limit(query.limit);
      return rows.map((row) => toArtist(row, resolveMediaUrl));
    },
    async facts(ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select({ id: shopArtist.id })
        .from(shopArtist)
        .where(inArray(shopArtist.id, [...ids]));
      return rows.map((row) => ({ kind: "artist", id: row.id }));
    },
  };

  const categories: SlotQueries<AdminHomeFeatureCategory> = {
    async placed() {
      const rows = await db
        .select(categoryColumns())
        .from(shopHomePlacement)
        .innerJoin(shopCategory, eq(shopHomePlacement.categoryId, shopCategory.id))
        .where(placedIn("featured_categories"))
        .orderBy(asc(shopHomePlacement.position));
      return rows.map(toCategory);
    },
    async search(query) {
      const like = pattern(query);
      const rows = await db
        .select(categoryColumns())
        .from(shopCategory)
        .where(like ? sql`${shopCategory.label} ILIKE ${like}` : undefined)
        .orderBy(asc(shopCategory.sortOrder), asc(shopCategory.label))
        .limit(query.limit);
      return rows.map(toCategory);
    },
    async facts(ids) {
      if (ids.length === 0) return [];
      const rows = await db
        .select({ id: shopCategory.id })
        .from(shopCategory)
        .where(inArray(shopCategory.id, [...ids]));
      return rows.map((row) => ({ kind: "category", id: row.id }));
    },
  };

  return {
    featured_prints: prints,
    featured_artists: artists,
    featured_categories: categories,
  } satisfies { [S in HomeFeatureSlot]: SlotQueries<AdminHomeFeatureRow<S>> };
}

/** The featured lists and their candidates, read with the facts behind each status line. */
export function createDrizzleHomeFeatureListReader(
  db: Database,
  options: { resolveMediaUrl: ResolveMediaUrl },
): HomeFeatureListReader {
  const queries = slotQueries(db, options.resolveMediaUrl);
  return {
    async list() {
      const [prints, artists, categories] = await Promise.all([
        queries.featured_prints.placed(),
        queries.featured_artists.placed(),
        queries.featured_categories.placed(),
      ]);
      return {
        featured_prints: prints,
        featured_artists: artists,
        featured_categories: categories,
      };
    },
    searchCandidates<S extends HomeFeatureSlot>(slot: S, query: SearchQuery) {
      return (queries[slot] as SlotQueries<AdminHomeFeatureRow<S>>).search(query);
    },
  };
}

/** What a save checks, on the save's own transaction. */
export function createDrizzleHomeFeatureTargetReader(db: Database): HomeFeatureTargetReader {
  const queries = slotQueries(db, () => null);
  return {
    async lockSlot(slot) {
      await db.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`shop_home_placement:${slot}`}))`,
      );
    },
    async slotIds(slot) {
      const rows = await db
        .select({
          artworkId: shopHomePlacement.artworkId,
          artistId: shopHomePlacement.artistId,
          categoryId: shopHomePlacement.categoryId,
        })
        .from(shopHomePlacement)
        .where(eq(shopHomePlacement.slot, slot))
        .orderBy(asc(shopHomePlacement.position));
      return rows.flatMap((row) => {
        const id = row.artworkId ?? row.artistId ?? row.categoryId;
        return id ? [id] : [];
      });
    },
    targetFacts(slot, ids) {
      return queries[slot].facts(ids);
    },
  };
}
