import {
  PUBLIC_BROWSE_LOT_STATUSES,
  PUBLIC_BROWSE_SALE_STATUSES,
  PUBLIC_LOT_STATUSES,
  PUBLIC_SALE_STATUSES,
} from "@auction/validators";
import { type SQL, sql } from "drizzle-orm";
import { saleIsAtgOwnedSql, saleIsLiveOnAtgSql } from "./atg-public-catalog.sql.js";

const publicBrowseLotStatusesSql = sql.join(
  PUBLIC_BROWSE_LOT_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

const publicBrowseSaleStatusesSql = sql.join(
  PUBLIC_BROWSE_SALE_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

const publicCatalogLotStatusesSql = sql.join(
  PUBLIC_LOT_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

const publicCatalogSaleStatusesSql = sql.join(
  PUBLIC_SALE_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

type AtgSaleSql = (saleIdRef: SQL) => SQL;

function parentSaleIsPublicSql(saleStatusesSql: SQL, atgDraftSql: AtgSaleSql) {
  return sql`
    lot.sale_id is null
    or exists (
      select 1
      from sale parent_sale
      where parent_sale.id = lot.sale_id
        and parent_sale.deleted_at is null
        and (
          parent_sale.status in (${saleStatusesSql})
          or (parent_sale.status = 'draft' and ${atgDraftSql(sql`parent_sale.id`)})
        )
    )
  `;
}

function artistPublicLotPredicatesSql(input: {
  lotStatusesSql: SQL;
  saleStatusesSql: SQL;
  atgDraftSql: AtgSaleSql;
}): SQL {
  return sql`
    lot.artist_id = artist_profile.id
    and lot.deleted_at is null
    and (
      lot.status in (${input.lotStatusesSql})
      or (
        lot.status = 'draft'
        and lot.sale_id is not null
        and ${input.atgDraftSql(sql`lot.sale_id`)}
      )
    )
    and (${parentSaleIsPublicSql(input.saleStatusesSql, input.atgDraftSql)})
  `;
}

/**
 * Correlates lot rows to the outer `artist_profile` row — browse surfaces (active + scheduled).
 * Draft lots of an ATG auction that is live count as upcoming.
 */
function artistPublicBrowseLotPredicatesSql(): SQL {
  return artistPublicLotPredicatesSql({
    lotStatusesSql: publicBrowseLotStatusesSql,
    saleStatusesSql: publicBrowseSaleStatusesSql,
    atgDraftSql: saleIsLiveOnAtgSql,
  });
}

/** Correlates lot rows to the outer `artist_profile` row — public catalogue (incl. ended). */
function artistPublicCatalogLotPredicatesSql(): SQL {
  return artistPublicLotPredicatesSql({
    lotStatusesSql: publicCatalogLotStatusesSql,
    saleStatusesSql: publicCatalogSaleStatusesSql,
    atgDraftSql: saleIsAtgOwnedSql,
  });
}

/** Count of public catalogue lots for directory cards (matches profile #works "All"). */
export function artistPublicCatalogLotCountSubquery() {
  return sql<number>`(
    select count(*)::int
    from lot
    where ${artistPublicCatalogLotPredicatesSql()}
  )`;
}

/** Count of public ended lots: the artist's results, for cards of artists with nothing on sale. */
export function artistPublicResultCountSubquery() {
  return sql<number>`(
    select count(*)::int
    from lot
    where ${artistPublicCatalogLotPredicatesSql()}
      and lot.status = 'ended'
  )`;
}

/**
 * First image of a representative public lot, for directory cards of artists without a portrait:
 * what is on sale first, then the most recent result. Lots without an image are skipped.
 */
export function artistRepresentativeWorkImageSubquery() {
  return sql<string | null>`(
    select lot.images[1]
    from lot
    where ${artistPublicCatalogLotPredicatesSql()}
      and cardinality(lot.images) > 0
      and coalesce(lot.images[1], '') <> ''
    order by (lot.status in ('active', 'scheduled')) desc, lot.created_at desc
    limit 1
  )`;
}

/** EXISTS filter for artists with upcoming (`active` | `scheduled`) browse lots. */
export function artistHasPublicBrowseLotsExists() {
  return sql`exists (
    select 1
    from lot
    where ${artistPublicBrowseLotPredicatesSql()}
  )`;
}
