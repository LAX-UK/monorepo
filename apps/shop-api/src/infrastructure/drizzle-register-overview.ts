import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { artworkRegister as register, shopArtwork } from "@auction/db/schema";
import { REGISTER_PLACE_VALUES } from "@auction/shop-contracts";
import { type SQL, and, asc, eq, isNull, sql } from "drizzle-orm";
import type {
  ArtworkRegisterOverview,
  RegisterOverviewFilter,
} from "../application/ports/artwork-register-review.ports.js";

/** A lax.art listing made from the record exists and buyers cannot see it (not published, or archived). */
const HAS_DRAFT = sql`(${shopArtwork.id} IS NOT NULL AND (${shopArtwork.publishedAt} IS NULL OR ${shopArtwork.archivedAt} IS NOT NULL))`;
/** The lax.art listing of a record; an edition run is never the listing of an original. */
const LISTING_JOIN = and(
  eq(shopArtwork.zohoProductId, register.zohoProductId),
  isNull(shopArtwork.runKind),
);
const HELD = sql`${register.offerState} = 'held'`;

/** Each place as a condition on the record and its lax.art listing; a draft only counts while held. */
const PLACE_CONDITION: Record<NonNullable<RegisterOverviewFilter["place"]>, SQL> = {
  not_offered: sql`(${HELD} AND NOT ${HAS_DRAFT})`,
  draft_lax_art: sql`(${HELD} AND ${HAS_DRAFT})`,
  lax_art: sql`${register.offerState} = 'lax_art'`,
  bid_sale: sql`${register.offerState} = 'bid_sale'`,
  private_sale: sql`${register.offerState} = 'private_sale'`,
  withdrawn: sql`${register.offerState} = 'withdrawn'`,
  sold: sql`${register.offerState} = 'sold'`,
};

function conditionOf(filter: RegisterOverviewFilter): SQL | undefined {
  return and(
    filter.artistCode ? eq(register.artistCode, filter.artistCode) : undefined,
    filter.place ? PLACE_CONDITION[filter.place] : undefined,
  );
}

/**
 * The register joined to the lax.art listing made from each record, so the All list can say
 * "Draft on lax.art" and filter by it in one query.
 */
export function createDrizzleRegisterOverviewReader(
  db: Database,
  toEntry: (row: typeof register.$inferSelect) => ArtworkRegisterEntry,
): ArtworkRegisterOverview {
  return {
    async listAll(filter, page) {
      const where = conditionOf(filter);
      const [rows, [counted]] = await Promise.all([
        db
          .select({ entry: register, hasDraft: sql<boolean>`${HAS_DRAFT}` })
          .from(register)
          .leftJoin(shopArtwork, LISTING_JOIN)
          .where(where)
          .orderBy(sql`${register.zohoModifiedAt} DESC NULLS LAST`, asc(register.id))
          .limit(page.limit)
          .offset(page.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(register)
          .leftJoin(shopArtwork, LISTING_JOIN)
          .where(where),
      ]);
      return {
        rows: rows.map((row) => ({ entry: toEntry(row.entry), hasLaxArtDraft: row.hasDraft })),
        total: counted?.total ?? 0,
      };
    },
    async countPlaces(artistCode) {
      const [row] = await db
        .select(
          Object.fromEntries(
            REGISTER_PLACE_VALUES.map((place) => [
              place,
              sql<number>`(count(*) FILTER (WHERE ${PLACE_CONDITION[place]}))::int`,
            ]),
          ) as Record<(typeof REGISTER_PLACE_VALUES)[number], SQL<number>>,
        )
        .from(register)
        .leftJoin(shopArtwork, LISTING_JOIN)
        .where(artistCode ? eq(register.artistCode, artistCode) : undefined);
      return (row ??
        Object.fromEntries(REGISTER_PLACE_VALUES.map((place) => [place, 0]))) as Record<
        (typeof REGISTER_PLACE_VALUES)[number],
        number
      >;
    },
    async listArtists() {
      return db
        .select({
          code: register.artistCode,
          name: sql<string>`min(${register.artistName})`,
          count: sql<number>`count(*)::int`,
        })
        .from(register)
        .groupBy(register.artistCode)
        .orderBy(sql`min(${register.artistName})`, asc(register.artistCode));
    },
  };
}
