import { saleNotDeleted } from "@auction/db";
import type { Database } from "@auction/db";
import { sale, saleroomSession } from "@auction/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { ISaleroomLiveSessionCounter } from "../interfaces/saleroom-live-session-counter.js";

export class DrizzleSaleroomLiveSessionCounter implements ISaleroomLiveSessionCounter {
  constructor(private readonly db: Database) {}

  async countLiveOrPausedOnActiveSales(): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(saleroomSession)
      .innerJoin(sale, eq(saleroomSession.saleId, sale.id))
      .where(
        and(
          inArray(saleroomSession.status, ["live", "paused"]),
          eq(sale.status, "active"),
          saleNotDeleted(),
        ),
      );
    return row?.n ?? 0;
  }
}
