import type { Database } from "@auction/db";
import { bid, bidIdentityDirectory, bidUserProfile, lot } from "@auction/db/schema";
import { asc, eq, min, sql } from "drizzle-orm";
import type { ISaleBiddersReader, SaleBidderRow } from "../interfaces/sale-bidders.reader.js";

function maskDisplayName(row: {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
}): string {
  const first = (row.firstName?.trim() || row.name?.trim().split(/\s+/)[0] || "").trim();
  const last = (
    row.lastName?.trim() ||
    row.name?.trim().split(/\s+/).slice(1).join(" ") ||
    ""
  ).trim();
  const safeFirst = first.length > 0 ? first : "Bidder";
  const initial = last.length > 0 ? `${last[0]?.toUpperCase()}.` : "";
  return initial ? `${safeFirst} ${initial}` : safeFirst;
}

export class DrizzleSaleBiddersReader implements ISaleBiddersReader {
  constructor(private readonly db: Database) {}

  async list(saleId: string, opts: { limit: number; offset: number }): Promise<SaleBidderRow[]> {
    const firstBidAt = min(bid.createdAt);
    const rows = await this.db
      .select({
        name: bidIdentityDirectory.name,
        firstName: bidUserProfile.firstName,
        lastName: bidUserProfile.lastName,
        firstBidAt,
      })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, bid.bidderId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bid.bidderId))
      .where(eq(lot.saleId, saleId))
      .groupBy(
        bid.bidderId,
        bidIdentityDirectory.name,
        bidUserProfile.firstName,
        bidUserProfile.lastName,
      )
      .orderBy(asc(firstBidAt))
      .limit(opts.limit)
      .offset(opts.offset);

    return rows.map((r) => ({
      maskedName: maskDisplayName({
        name: r.name,
        firstName: r.firstName,
        lastName: r.lastName,
      }),
      firstBidAt: r.firstBidAt ?? new Date(0),
    }));
  }

  async countDistinct(saleId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(distinct ${bid.bidderId})::int` })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(eq(lot.saleId, saleId));
    return row?.n ?? 0;
  }
}
