import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, sale, saleroomSession } from "@auction/db/schema";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, eq } from "drizzle-orm";
import type { ISaleroomSessionLookup } from "../interfaces/saleroom-session.lookup.js";

type SaleroomBidControlRow = {
  deliveryMode: (typeof sale.$inferSelect)["deliveryMode"] | null;
  allowOnlineBidsBeforeGoLive: boolean | null;
  sessionStatus: (typeof saleroomSession.$inferSelect)["status"] | null;
};

export class DrizzleSaleroomSessionLookup implements ISaleroomSessionLookup {
  constructor(private readonly db: Database) {}

  private async loadSaleroomBidControlRow(lotId: string): Promise<SaleroomBidControlRow | null> {
    const rows = await this.db
      .select({
        deliveryMode: sale.deliveryMode,
        allowOnlineBidsBeforeGoLive: sale.allowOnlineBidsBeforeGoLive,
        sessionStatus: saleroomSession.status,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(saleroomSession, eq(saleroomSession.saleId, sale.id))
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    return rows[0] ?? null;
  }

  async shouldSkipAntiSnipeForLot(lotId: string): Promise<boolean> {
    const row = await this.loadSaleroomBidControlRow(lotId);
    if (!row?.deliveryMode || !isSaleroomDeliveryMode(row.deliveryMode)) {
      return false;
    }
    return row.sessionStatus === "live" || row.sessionStatus === "paused";
  }

  async shouldEnforceOnBlockGateForLot(lotId: string): Promise<boolean> {
    const row = await this.loadSaleroomBidControlRow(lotId);
    if (!row?.deliveryMode || !isSaleroomDeliveryMode(row.deliveryMode)) {
      return false;
    }
    if (row.deliveryMode === "hybrid" && !row.allowOnlineBidsBeforeGoLive) {
      return true;
    }
    return row.sessionStatus === "live" || row.sessionStatus === "paused";
  }

  async isLotUnderLiveClerkSession(lotId: string): Promise<boolean> {
    return this.shouldSkipAntiSnipeForLot(lotId);
  }
}
