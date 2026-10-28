import type { Database } from "@auction/db";
import { absenteeBid, bid, lot } from "@auction/db/schema";
import { type SQL, and, count, inArray, isNull, sql } from "drizzle-orm";
import type { CurrencyCountRow, IOpenBidsReader } from "../interfaces/index.js";
import { lotCurrencySql } from "./organisation-dashboard.sql.js";

/** Lots that can still take a bid. */
const OPEN_LOT_STATUSES = ["scheduled", "active"] as const;

/**
 * The organisation's commitment on each open lot: its highest bid or auto-bid ceiling, or its
 * scheduled absentee maximum, whichever is more. Lots are found through the bidder indexes.
 */
export class DrizzleOpenBidsReader implements IOpenBidsReader {
  constructor(private readonly db: Database) {}

  async summarise(legalEntityId: string, bidderUserId: string | null): Promise<CurrencyCountRow[]> {
    const byBidder: SQL = bidderUserId ? sql`and ${bid.bidderId} = ${bidderUserId}` : sql``;
    const byAbsentee: SQL = bidderUserId ? sql`and ${absenteeBid.userId} = ${bidderUserId}` : sql``;
    const bidTop = sql`(select max(greatest(${bid.amount}, coalesce(${bid.maxAutoBidAmount}, 0)))
      from ${bid} where ${bid.lotId} = ${lot.id} and ${bid.buyerLegalEntityId} = ${legalEntityId} ${byBidder})`;
    const absenteeTop = sql`(select max(${absenteeBid.maxAmount}) from ${absenteeBid}
      where ${absenteeBid.lotId} = ${lot.id} and ${absenteeBid.buyerLegalEntityId} = ${legalEntityId}
      and ${absenteeBid.status} = 'scheduled' ${byAbsentee})`;
    const lotsWithBids = sql`(
      select ${bid.lotId} from ${bid} where ${bid.buyerLegalEntityId} = ${legalEntityId} ${byBidder}
      union
      select ${absenteeBid.lotId} from ${absenteeBid}
      where ${absenteeBid.buyerLegalEntityId} = ${legalEntityId} and ${absenteeBid.status} = 'scheduled' ${byAbsentee}
    )`;

    const perLot = this.db
      .select({
        currency: sql<string>`${lotCurrencySql}`.as("currency"),
        top: sql<string>`greatest(${bidTop}, ${absenteeTop})`.as("top"),
      })
      .from(lot)
      .where(
        and(
          inArray(lot.id, lotsWithBids),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
          isNull(lot.deletedAt),
        ),
      )
      .as("per_lot");

    const rows = await this.db
      .select({
        currency: perLot.currency,
        count: count(),
        amount: sql<string>`coalesce(sum(${perLot.top}), 0)`,
      })
      .from(perLot)
      .groupBy(perLot.currency);
    return rows.map((row) => ({
      currency: row.currency,
      count: Number(row.count),
      amount: String(row.amount),
    }));
  }
}
