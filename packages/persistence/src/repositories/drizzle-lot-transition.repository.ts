import type { Database } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import type { LotStatus } from "@auction/types";
import { eq, sql } from "drizzle-orm";
import type { ILotTransitionRepository } from "../interfaces/lot-transition.repository.js";

export class DrizzleLotTransitionRepository implements ILotTransitionRepository {
  async findLotForUpdate(tx: Database, lotId: string) {
    const [row] = await tx.select().from(lot).where(eq(lot.id, lotId)).limit(1);
    return row ?? null;
  }

  async resetLotForInventoryReturn(
    tx: Database,
    lotId: string,
    _fromStatus: LotStatus,
  ): Promise<void> {
    await tx
      .update(lot)
      .set({
        status: "draft",
        saleId: null,
        lotNumber: null,
        winnerId: null,
        buyerLegalEntityId: null,
        currentPrice: sql`${lot.startingPrice}`,
        voidedReason: null,
        updatedAt: new Date(),
      })
      .where(eq(lot.id, lotId));

    await tx.update(bid).set({ isWinning: false }).where(eq(bid.lotId, lotId));
  }
}

export function createDrizzleLotTransitionRepository(
  _db: Database,
): DrizzleLotTransitionRepository {
  return new DrizzleLotTransitionRepository();
}
