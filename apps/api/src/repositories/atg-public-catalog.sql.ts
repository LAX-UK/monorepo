import { atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import type { LotStatus, SaleStatus } from "@auction/types";
import { PUBLIC_LOT_STATUSES, PUBLIC_SALE_STATUSES } from "@auction/validators";
import { type SQL, and, eq, inArray, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

type SaleIdRef = SQL | AnyPgColumn;

/** Sale whose ATG auction is published (bidding open on the White Label). */
export function saleIsLiveOnAtgSql(saleIdRef: SaleIdRef): SQL {
  return sql`exists (
    select 1 from ${atgAuctionLink} al
    where al.sale_id = ${saleIdRef}
      and al.atg_auction_id is not null
      and al.remote_status = 'published'
      and al.distribution = 'public_marketplace'
  )`;
}

/** Sale whose ATG auction closed with at least one lot sold. */
export function saleEndedOnAtgWithSalesSql(saleIdRef: SaleIdRef): SQL {
  return sql`exists (
    select 1 from ${atgAuctionLink} al
    where al.sale_id = ${saleIdRef}
      and al.atg_auction_id is not null
      and al.remote_status = 'closed'
      and al.distribution = 'public_marketplace'
      and exists (
        select 1 from ${atgLotLink} ll
        where ll.sale_id = al.sale_id and ll.sold = true
      )
  )`;
}

/** Draft LAX sale owned by ATG (see `resolveSaleSellingPlatform`) — read-only on lax.bid. */
export function saleIsAtgOwnedSql(saleIdRef: SaleIdRef): SQL {
  return sql`(${saleIsLiveOnAtgSql(saleIdRef)} or ${saleEndedOnAtgWithSalesSql(saleIdRef)})`;
}

/**
 * ATG ownership check matching a public status filter: a live ATG auction counts as
 * scheduled/active, a closed one with sales counts as ended. Undefined when nothing matches.
 */
function saleOnAtgForStatusesSql(
  saleIdRef: SaleIdRef,
  statuses: readonly string[],
): SQL | undefined {
  const live = statuses.includes("scheduled") || statuses.includes("active");
  const ended = statuses.includes("ended");
  if (live && ended) return saleIsAtgOwnedSql(saleIdRef);
  if (live) return saleIsLiveOnAtgSql(saleIdRef);
  if (ended) return saleEndedOnAtgWithSalesSql(saleIdRef);
  return undefined;
}

/** Draft sales owned by ATG that belong in a public sale list filtered by `statuses`. */
export function atgOwnedDraftSaleForStatusesSql(statuses: readonly SaleStatus[]): SQL | undefined {
  const onAtg = saleOnAtgForStatusesSql(sale.id, statuses);
  return onAtg ? and(eq(sale.status, "draft"), onAtg) : undefined;
}

/** Draft lots in ATG-owned sales that belong in a public lot list filtered by `statuses`. */
export function atgOwnedDraftLotForStatusesSql(statuses: readonly LotStatus[]): SQL | undefined {
  const onAtg = saleOnAtgForStatusesSql(lot.saleId, statuses);
  return onAtg ? and(eq(lot.status, "draft"), sql`${lot.saleId} is not null`, onAtg) : undefined;
}

function requireSql(condition: SQL | undefined, name: string): SQL {
  if (!condition) throw new Error(`${name}: empty condition`);
  return condition;
}

/** Public marketing visibility for sales (includes ATG-owned drafts). */
export function publicSaleCondition(): SQL {
  return requireSql(
    or(
      inArray(sale.status, [...PUBLIC_SALE_STATUSES] as SaleStatus[]),
      and(eq(sale.status, "draft"), saleIsAtgOwnedSql(sale.id)),
    ),
    "publicSaleCondition",
  );
}

/** Public marketing visibility for lots joined to their sale. */
export function publicLotCondition(): SQL {
  return requireSql(
    or(
      inArray(lot.status, [...PUBLIC_LOT_STATUSES] as LotStatus[]),
      and(eq(lot.status, "draft"), sql`${lot.saleId} is not null`, saleIsAtgOwnedSql(lot.saleId)),
    ),
    "publicLotCondition",
  );
}
