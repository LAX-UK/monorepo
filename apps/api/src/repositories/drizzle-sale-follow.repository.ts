import type { Database } from "@auction/db";
import { saleFollow } from "@auction/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { ISaleFollowRepository, SaleFollowRow } from "../services/interfaces/sale-follow.js";

function mapRow(row: typeof saleFollow.$inferSelect): SaleFollowRow {
  return {
    id: row.id,
    userId: row.userId,
    saleId: row.saleId,
    createdAt: row.createdAt,
  };
}

export class DrizzleSaleFollowRepository implements ISaleFollowRepository {
  constructor(private readonly db: Database) {}

  async add(userId: string, saleId: string): Promise<SaleFollowRow> {
    await this.db
      .insert(saleFollow)
      .values({ userId, saleId })
      .onConflictDoNothing({ target: [saleFollow.userId, saleFollow.saleId] });
    const [row] = await this.db
      .select()
      .from(saleFollow)
      .where(and(eq(saleFollow.userId, userId), eq(saleFollow.saleId, saleId)))
      .limit(1);
    if (!row) throw new Error("Sale follow insert failed");
    return mapRow(row);
  }

  async remove(userId: string, saleId: string): Promise<void> {
    await this.db
      .delete(saleFollow)
      .where(and(eq(saleFollow.userId, userId), eq(saleFollow.saleId, saleId)));
  }

  async exists(userId: string, saleId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: saleFollow.id })
      .from(saleFollow)
      .where(and(eq(saleFollow.userId, userId), eq(saleFollow.saleId, saleId)))
      .limit(1);
    return rows.length > 0;
  }

  async countForSale(saleId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(saleFollow)
      .where(eq(saleFollow.saleId, saleId));
    return row?.n ?? 0;
  }
}
