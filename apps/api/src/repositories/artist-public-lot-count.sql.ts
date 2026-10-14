import {
  PUBLIC_BROWSE_LOT_STATUSES,
  PUBLIC_BROWSE_SALE_STATUSES,
  PUBLIC_LOT_STATUSES,
  PUBLIC_SALE_STATUSES,
} from "@auction/validators";
import { type SQL, sql } from "drizzle-orm";

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

function parentSaleIsPublicSql(saleStatusesSql: ReturnType<typeof sql.join>) {
  return sql`
    lot.sale_id is null
    or exists (
      select 1
      from sale parent_sale
      where parent_sale.id = lot.sale_id
        and parent_sale.deleted_at is null
        and (
          parent_sale.status in (${saleStatusesSql})
          or (
            parent_sale.status = 'draft'
            and exists (
              select 1 from atg_auction_link al
              where al.sale_id = parent_sale.id
                and al.atg_auction_id is not null
                and (
                  al.remote_status = 'published'
                  or (
                    al.remote_status = 'closed'
                    and exists (
                      select 1 from atg_lot_link ll
                      where ll.sale_id = al.sale_id and ll.sold = true
                    )
                  )
                )
            )
          )
        )
    )
  `;
}

/** Correlates lot rows to the outer `artist_profile` row — browse surfaces (active + scheduled). */
function artistPublicBrowseLotPredicatesSql(): SQL {
  return sql`
    lot.artist_id = artist_profile.id
    and lot.deleted_at is null
    and (
      lot.status in (${publicBrowseLotStatusesSql})
      or (
        lot.status = 'draft'
        and lot.sale_id is not null
        and exists (
          select 1 from atg_auction_link al
          where al.sale_id = lot.sale_id
            and al.atg_auction_id is not null
            and al.remote_status = 'published'
        )
      )
    )
    and (${parentSaleIsPublicSql(publicBrowseSaleStatusesSql)})
  `;
}

/** Correlates lot rows to the outer `artist_profile` row — public catalogue (incl. ended). */
function artistPublicCatalogLotPredicatesSql(): SQL {
  return sql`
    lot.artist_id = artist_profile.id
    and lot.deleted_at is null
    and (
      lot.status in (${publicCatalogLotStatusesSql})
      or (
        lot.status = 'draft'
        and lot.sale_id is not null
        and exists (
          select 1 from atg_auction_link al
          where al.sale_id = lot.sale_id
            and al.atg_auction_id is not null
            and (
              al.remote_status = 'published'
              or (
                al.remote_status = 'closed'
                and exists (
                  select 1 from atg_lot_link ll
                  where ll.sale_id = al.sale_id and ll.sold = true
                )
              )
            )
        )
      )
    )
    and (${parentSaleIsPublicSql(publicCatalogSaleStatusesSql)})
  `;
}

/** Count of public catalogue lots for directory cards (matches profile #works "All"). */
export function artistPublicCatalogLotCountSubquery() {
  return sql<number>`(
    select count(*)::int
    from lot
    where ${artistPublicCatalogLotPredicatesSql()}
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
