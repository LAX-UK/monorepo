import { PUBLIC_BROWSE_LOT_STATUSES, PUBLIC_BROWSE_SALE_STATUSES } from "@auction/validators";
import { type SQL, sql } from "drizzle-orm";

const publicBrowseLotStatusesSql = sql.join(
  PUBLIC_BROWSE_LOT_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

const publicBrowseSaleStatusesSql = sql.join(
  PUBLIC_BROWSE_SALE_STATUSES.map((status) => sql`${status}`),
  sql`, `,
);

/** Correlates lot rows to the outer `artist_profile` row in directory queries. */
function artistPublicBrowseLotPredicatesSql(): SQL {
  return sql`
    lot.artist_id = artist_profile.id
    and lot.deleted_at is null
    and lot.status in (${publicBrowseLotStatusesSql})
    and (
      lot.sale_id is null
      or exists (
        select 1
        from sale parent_sale
        where parent_sale.id = lot.sale_id
          and parent_sale.deleted_at is null
          and parent_sale.status in (${publicBrowseSaleStatusesSql})
      )
    )
  `;
}

/** Count of lots browseable on the public artist directory (active + scheduled on public sales). */
export function artistPublicBrowseLotCountSubquery() {
  return sql<number>`(
    select count(*)::int
    from lot
    where ${artistPublicBrowseLotPredicatesSql()}
  )`;
}

/** EXISTS filter matching `artistPublicBrowseLotCountSubquery` semantics. */
export function artistHasPublicBrowseLotsExists() {
  return sql`exists (
    select 1
    from lot
    where ${artistPublicBrowseLotPredicatesSql()}
  )`;
}
