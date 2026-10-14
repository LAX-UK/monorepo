import { atgAuctionLink, atgLotLink, lot, sale } from "@auction/db/schema";
import type { LotStatus, SaleStatus } from "@auction/types";
import {
  PUBLIC_BROWSE_SALE_STATUSES,
  PUBLIC_LOT_STATUSES,
  PUBLIC_SALE_STATUSES,
} from "@auction/validators";
import { type SQL, and, eq, inArray, or, sql } from "drizzle-orm";

/** Draft LAX sale that is live (or was live with sales) on ATG — visible as read-only on lax.bid. */
export function saleIsAtgOwnedSql(saleIdRef: SQL | typeof sale.id): SQL {
  return sql`exists (
    select 1 from ${atgAuctionLink} al
    where al.sale_id = ${saleIdRef}
      and al.atg_auction_id is not null
      and (
        al.remote_status = 'published'
        or (
          al.remote_status = 'closed'
          and exists (
            select 1 from ${atgLotLink} ll
            where ll.sale_id = al.sale_id and ll.sold = true
          )
        )
      )
  )`;
}

/** Home / browse strips: live LAX sales plus ATG-owned drafts. */
export function publicBrowseSaleCondition(): SQL {
  const condition = or(
    inArray(sale.status, [...PUBLIC_BROWSE_SALE_STATUSES] as SaleStatus[]),
    and(eq(sale.status, "draft"), saleIsAtgOwnedSql(sale.id)),
  );
  if (!condition) throw new Error("publicBrowseSaleCondition: empty OR");
  return condition;
}

/** Public marketing visibility for sales (includes ATG-owned drafts). */
export function publicSaleCondition(): SQL {
  const condition = or(
    inArray(sale.status, [...PUBLIC_SALE_STATUSES] as SaleStatus[]),
    and(eq(sale.status, "draft"), saleIsAtgOwnedSql(sale.id)),
  );
  if (!condition) throw new Error("publicSaleCondition: empty OR");
  return condition;
}

/** Public marketing visibility for lots joined to their sale. */
export function publicLotCondition(): SQL {
  const condition = or(
    inArray(lot.status, [...PUBLIC_LOT_STATUSES] as LotStatus[]),
    and(eq(lot.status, "draft"), sql`${lot.saleId} is not null`, saleIsAtgOwnedSql(lot.saleId)),
  );
  if (!condition) throw new Error("publicLotCondition: empty OR");
  return condition;
}
