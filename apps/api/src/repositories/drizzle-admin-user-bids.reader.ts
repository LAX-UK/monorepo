import type { Database } from "@auction/db";
import { bid, lot, sale } from "@auction/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import type {
  AdminUserBidListResult,
  IAdminUserBidsReader,
} from "../services/interfaces/admin-user.js";

export class DrizzleAdminUserBidsReader implements IAdminUserBidsReader {
  constructor(private readonly db: Database) {}

  async listForUser(
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<AdminUserBidListResult> {
    const where = eq(bid.bidderId, userId);
    const [countRow] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(bid)
      .where(where);
    const rows = await this.db
      .select({
        id: bid.id,
        lotId: bid.lotId,
        lotTitle: lot.title,
        saleId: lot.saleId,
        saleTitle: sale.title,
        amount: bid.amount,
        isWinning: bid.isWinning,
        isAutoBid: bid.isAutoBid,
        placedVia: bid.placedVia,
        createdAt: bid.createdAt,
      })
      .from(bid)
      .innerJoin(lot, eq(bid.lotId, lot.id))
      .leftJoin(sale, eq(lot.saleId, sale.id))
      .where(where)
      .orderBy(desc(bid.createdAt))
      .limit(page.limit)
      .offset(page.offset);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        lotId: r.lotId,
        lotTitle: r.lotTitle,
        saleId: r.saleId,
        saleTitle: r.saleTitle,
        amount: r.amount,
        isWinning: r.isWinning,
        isAutoBid: r.isAutoBid,
        placedVia: r.placedVia,
        createdAt: r.createdAt,
      })),
      total: countRow?.total ?? 0,
    };
  }
}
