import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, sale, saleroomSession } from "@auction/db/schema";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, eq } from "drizzle-orm";
import type { ISaleroomSessionLookup } from "../services/interfaces/saleroom-session-lookup.js";

export class DrizzleSaleroomSessionLookup implements ISaleroomSessionLookup {
  constructor(private readonly db: Database) {}

  async shouldSkipAntiSnipeForLot(lotId: string): Promise<boolean> {
    const rows = await this.db
      .select({
        deliveryMode: sale.deliveryMode,
        sessionStatus: saleroomSession.status,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(saleroomSession, eq(saleroomSession.saleId, sale.id))
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    const row = rows[0];
    if (!row?.deliveryMode || !isSaleroomDeliveryMode(row.deliveryMode)) {
      return false;
    }
    return row.sessionStatus === "live" || row.sessionStatus === "paused";
  }
}
