import { buyerDefault, lotReoffer, payment } from "@auction/db/schema";
import { type SQL, sql } from "drizzle-orm";

/**
 * Every column here is written with its table alias. Drizzle drops the table from a column inside a
 * single-table select list, and a bare `id` in a nested query then reads the nearest table's own
 * `id`, so the lot's result would come out wrong in a list and right in a filter.
 */
const lotCol = {
  id: sql.raw('"lot"."id"'),
  winnerId: sql.raw('"lot"."winner_id"'),
  endTime: sql.raw('"lot"."end_time"'),
  buyerLegalEntityId: sql.raw('"lot"."buyer_legal_entity_id"'),
};

/**
 * The lot's public result is not final: its winner did not pay and the lot is being offered on to
 * the next bidder, or it has been re-awarded and the new buyer has not paid yet. Public pages say
 * "Ended" for such a lot, and no price. It is the one place that decides it, so every public read
 * (a lot, a sale's results, the archive total) agrees.
 *
 * Only the lot's latest buyer default counts, and only one that offered the lot on:
 * - no buyer yet, and the lot has not closed again since the default; or
 * - a buyer from a re-offer of that default, who has not paid.
 * A lot that went back to inventory and sold again has closed after the default, so it reads as
 * any other lot. The query must select from `lot`.
 */
export function lotResultPendingSql(): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${buyerDefault} as bd
    where bd.lot_id = ${lotCol.id}
      and bd.outcome = 'offered_to_underbidder'
      and not exists (
        select 1 from ${buyerDefault} as later
        where later.lot_id = ${lotCol.id}
          and (later.created_at, later.id) > (bd.created_at, bd.id)
      )
      and (
        (${lotCol.winnerId} is null and ${lotCol.endTime} <= bd.created_at)
        or (
          ${lotCol.winnerId} is not null
          and exists (
            select 1 from ${lotReoffer} as r
            where r.buyer_default_id = bd.id
              and r.reawarded_at is not null
              and r.offered_user_id = ${lotCol.winnerId}
              and r.offered_legal_entity_id = ${lotCol.buyerLegalEntityId}
          )
          and not exists (
            select 1 from ${payment} as p
            where p.lot_id = ${lotCol.id}
              and p.buyer_legal_entity_id = ${lotCol.buyerLegalEntityId}
              and p.status = 'captured'
          )
        )
      )
  )`;
}

/** The lot was re-awarded to its current buyer after the first buyer defaulted. */
export function lotSoldAfterAuctionSql(): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${lotReoffer} as r
    where r.lot_id = ${lotCol.id}
      and r.reawarded_at is not null
      and r.offered_user_id = ${lotCol.winnerId}
      and r.offered_legal_entity_id = ${lotCol.buyerLegalEntityId}
  )`;
}
