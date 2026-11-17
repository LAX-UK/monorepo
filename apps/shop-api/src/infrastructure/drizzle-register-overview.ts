import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  artworkConsignorLink,
  artworkLocation,
  artworkLocationMove,
  artworkRegister as register,
  shopArtwork,
  shopClientAssignment,
  shopParty,
} from "@auction/db/schema";
import {
  REGISTER_CONSIGNOR_LAX,
  REGISTER_CONSIGNOR_NONE,
  REGISTER_LOCATION_NONE,
  REGISTER_PLACE_VALUES,
} from "@auction/shop-contracts";
import { type SQL, and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  ArtworkRegisterOverview,
  RegisterConsignorCounts,
  RegisterConsignorScope,
  RegisterOverviewConsignor,
  RegisterOverviewFilter,
  RegisterOverviewSort,
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

/**
 * Where the artwork physically is: the location of its latest move (one index probe on
 * `artwork_location_move (register_id, moved_at)`), null when none is recorded.
 */
const CURRENT_LOCATION_ID = sql<string | null>`(
  SELECT ${artworkLocationMove.locationId} FROM ${artworkLocationMove}
   WHERE ${artworkLocationMove.registerId} = ${register.id}
   ORDER BY ${artworkLocationMove.movedAt} DESC
   LIMIT 1
)`;

function locationCondition(location: string): SQL {
  return location === REGISTER_LOCATION_NONE
    ? sql`${CURRENT_LOCATION_ID} IS NULL`
    : sql`${CURRENT_LOCATION_ID} = ${location}`;
}

/**
 * A column of the record's consignor now: its latest consignor link (one index probe on
 * `artwork_consignor_link (register_id, set_at)`), null when none is set.
 */
function currentConsignorColumn(column: "id" | "consignor" | "party_id"): SQL {
  return sql`(
  SELECT ${sql.identifier(column)} FROM ${artworkConsignorLink}
   WHERE ${artworkConsignorLink.registerId} = ${register.id}
   ORDER BY ${artworkConsignorLink.setAt} DESC
   LIMIT 1
)`;
}

/** The record's consignor now, joined under its own name beside the subquery that finds it. */
const currentLink = alias(artworkConsignorLink, "current_consignor_link");
const consignorParty = alias(shopParty, "consignor_party");

/** Who consigned a work is recorded for originals; a print is LAX's own edition. */
const ORIGINAL = eq(register.kind, "original");

function consignorCondition(consignor: string): SQL | undefined {
  if (consignor === REGISTER_CONSIGNOR_NONE)
    return and(ORIGINAL, sql`${currentConsignorColumn("id")} IS NULL`);
  if (consignor === REGISTER_CONSIGNOR_LAX)
    return and(ORIGINAL, sql`${currentConsignorColumn("consignor")} = 'lax'`);
  return and(ORIGINAL, sql`${currentConsignorColumn("party_id")} = ${consignor}`);
}

function consignorOf(row: {
  kind: string;
  consignorKind: string | null;
  consignorPartyId: string | null;
  consignorName: string | null;
  consignorInScope: boolean | null;
}): RegisterOverviewConsignor | null {
  if (row.kind !== "original") return { kind: "not_shown" };
  if (row.consignorKind === "lax") return { kind: "lax" };
  if (row.consignorKind === "client" && row.consignorPartyId) {
    if (row.consignorInScope !== true) return { kind: "not_shown" };
    return {
      kind: "client",
      partyId: row.consignorPartyId,
      displayName: row.consignorName ?? "Unknown client",
    };
  }
  return null;
}

function conditionOf(filter: RegisterOverviewFilter): SQL | undefined {
  return and(
    filter.artistCode ? eq(register.artistCode, filter.artistCode) : undefined,
    filter.place ? PLACE_CONDITION[filter.place] : undefined,
    filter.location ? locationCondition(filter.location) : undefined,
    filter.consignor ? consignorCondition(filter.consignor) : undefined,
  );
}

/**
 * The order of the All list. By price, zero reads as unset (as `zohoPriceMinor` does in Admin), so
 * every unpriced work sorts after the priced ones in both directions; the id breaks ties, so
 * offset paging never repeats or skips a row.
 */
function orderOf(sort: RegisterOverviewSort | undefined): SQL[] {
  const price = sql`NULLIF(${register.zohoPrice}, 0)`;
  switch (sort) {
    case "zohoPrice":
      return [sql`${price} ASC NULLS LAST`, asc(register.id)];
    case "-zohoPrice":
      return [sql`${price} DESC NULLS LAST`, asc(register.id)];
    default:
      return [sql`${register.zohoModifiedAt} DESC NULLS LAST`, asc(register.id)];
  }
}

/**
 * The register joined to the lax.art listing made from each record, so the All list can say
 * "Draft on lax.art" and filter by it in one query, and to the location of each record's latest
 * move, for its Location column and filter.
 */
export function createDrizzleRegisterOverviewReader(
  db: Database,
  toEntry: (row: typeof register.$inferSelect) => ArtworkRegisterEntry,
): ArtworkRegisterOverview {
  /**
   * Whether the current consignor's client is one the reader sees: every client, or the clients
   * assigned to the broker, as on the Clients page.
   */
  function partyInScope(scope: RegisterConsignorScope | undefined): SQL {
    if (!scope || scope.kind === "all") return sql`true`;
    return inArray(
      currentLink.partyId,
      db
        .select({ id: shopClientAssignment.clientPartyId })
        .from(shopClientAssignment)
        .where(eq(shopClientAssignment.brokerSubjectId, scope.brokerSubjectId)),
    );
  }

  return {
    async listAll(filter, page, sort, consignorScope) {
      const where = conditionOf(filter);
      const [rows, [counted]] = await Promise.all([
        db
          .select({
            entry: register,
            hasDraft: sql<boolean>`${HAS_DRAFT}`,
            locationId: artworkLocation.id,
            locationName: artworkLocation.name,
            locationStatus: artworkLocation.status,
            consignorKind: currentLink.consignor,
            consignorPartyId: currentLink.partyId,
            consignorName: consignorParty.displayName,
            consignorInScope: sql<boolean | null>`${partyInScope(consignorScope)}`,
          })
          .from(register)
          .leftJoin(shopArtwork, LISTING_JOIN)
          .leftJoin(artworkLocation, eq(artworkLocation.id, CURRENT_LOCATION_ID))
          .leftJoin(currentLink, eq(currentLink.id, currentConsignorColumn("id")))
          .leftJoin(consignorParty, eq(consignorParty.id, currentLink.partyId))
          .where(where)
          .orderBy(...orderOf(sort))
          .limit(page.limit)
          .offset(page.offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(register)
          .leftJoin(shopArtwork, LISTING_JOIN)
          .where(where),
      ]);
      return {
        rows: rows.map((row) => ({
          entry: toEntry(row.entry),
          hasLaxArtDraft: row.hasDraft,
          location:
            row.locationId && row.locationName && row.locationStatus
              ? { id: row.locationId, name: row.locationName, status: row.locationStatus }
              : null,
          consignor: consignorOf({ ...row, kind: row.entry.kind }),
        })),
        total: counted?.total ?? 0,
      };
    },
    async countConsignors(consignorScope) {
      const rows = await db
        .select({
          consignorKind: currentLink.consignor,
          consignorPartyId: currentLink.partyId,
          consignorName: consignorParty.displayName,
          count: sql<number>`count(*)::int`,
        })
        .from(register)
        .leftJoin(currentLink, eq(currentLink.id, currentConsignorColumn("id")))
        .leftJoin(consignorParty, eq(consignorParty.id, currentLink.partyId))
        // Originals only; a client outside the reader's scope is left out, not counted elsewhere.
        .where(and(ORIGINAL, or(isNull(currentLink.partyId), partyInScope(consignorScope))))
        .groupBy(currentLink.consignor, currentLink.partyId, consignorParty.displayName);
      const counts: RegisterConsignorCounts = { none: 0, lax: 0, clients: [] };
      for (const row of rows) {
        const consignor = consignorOf({ ...row, kind: "original", consignorInScope: true });
        if (consignor === null) counts.none += row.count;
        else if (consignor.kind === "lax") counts.lax += row.count;
        else if (consignor.kind === "client")
          counts.clients.push({
            partyId: consignor.partyId,
            displayName: consignor.displayName,
            count: row.count,
          });
      }
      counts.clients.sort(
        (a, b) =>
          a.displayName.localeCompare(b.displayName, "en-GB") || (a.partyId < b.partyId ? -1 : 1),
      );
      return counts;
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
